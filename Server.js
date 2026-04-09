const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const { exec } = require("child_process");

const app = express();

/* ---------------- Middleware ---------------- */

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cors());
app.use(express.static(__dirname));

/* ---------------- MongoDB Settings ---------------- */

mongoose.set("bufferCommands", false);

/* ---------------- User Schema ---------------- */

const UserSchema = new mongoose.Schema({
  name: String,
  password: String,
  email: String,
  phone: String,
  location: String,
  bio: String,
  profilePic: String,
  skills: [String],
  profileCompleted: { type: Boolean, default: false },
  banned: { type: Boolean, default: false },
  savedAcademies: { type: [String], default: [] },
  savedCompetitions: { type: [String], default: [] }
});

const User = mongoose.model("User", UserSchema);

/* ---------------- Feedback Schema ---------------- */

const FeedbackSchema = new mongoose.Schema({
  name: String,
  email: String,
  message: String,
  rating: Number,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Feedback = mongoose.model("Feedback", FeedbackSchema);
 
/* ---------------- Competition Schema ---------------- */

const CompetitionSchema = new mongoose.Schema({
  id: String,
  name: String,
  category: String,
  skill: String,
  date: String,
  time: String,
  deadline: String,
  location: String,
  venue: String,
  organizer: String,
  description: String,
  prize: String,
  eligibility: String,
  team_size: String,
  phone: String,
  email: String,
  website: String,
  registration_link: String
});

const Competition = mongoose.model("Competition", CompetitionSchema);

const academySchema = new mongoose.Schema({
    name: String,
    skill: String,
    rating: Number,
    reviews_count: Number,
    address: String,
    phone: String,
    email: String,
    website: String,
    description: String,
    hours: [String],
    location: {
        lat: Number,
        lng: Number
    },
    courses: [String],
    district: String,
    register: String,
    category: String   // ⭐ IMPORTANT (technical, creative, etc)
});

const Academy = mongoose.model("Academy", academySchema);

/* ---------------- APIs ---------------- */

// Register
app.post("/register", async (req, res) => {
  try {
    const { name, password } = req.body;

    const rule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@#$%^&*]).{8,}$/;

    if (!rule.test(password)) {
      return res.status(400).json({ msg: "Password not satisfied" });
    }

    const existingUser = await User.findOne({ name });
    if (existingUser) {
      return res.status(400).json({ msg: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      password: hashedPassword,
      email: "",
      phone: "",
      location: "",
      bio: "",
      profilePic: ""
    });

    await newUser.save();

    res.json({ msg: "Registered Successfully" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login

    // Login
app.post("/login", async (req, res) => {
  try {
    const { name, password } = req.body;

    const user = await User.findOne({ name });
    if (!user) {
      return res.status(401).json({ msg: "User not found" });
    }

    // ✅ ADD THIS CHECK
    if (user.banned) {
      return res.status(403).json({ msg: "You are banned by admin" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ msg: "Invalid credentials" });
    }

    res.json({ msg: "Login successful", name: user.name });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Profile
app.get("/profile/:name", async (req, res) => {
  try {
    const user = await User.findOne({ name: req.params.name });

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    res.json(user);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Profile
app.post("/updateProfile", async (req, res) => {
  try {
    const { name, email, phone, location, bio, profilePic, skills } = req.body;

    const isComplete = !!(email && phone && location && bio && skills && skills.length > 0);

    const user = await User.findOneAndUpdate(
      { name },
      { email, phone, location, bio, profilePic, skills, profileCompleted: isComplete },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    res.json({ msg: "Profile updated successfully", user });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Change Password
app.post("/changePassword", async (req, res) => {
  try {
    const { name, currentPassword, newPassword } = req.body;

    if (!name || !currentPassword || !newPassword) {
      return res.status(400).json({ msg: "All fields are required" });
    }

    const user = await User.findOne({ name });
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ msg: "Current password is incorrect" });
    }

    const rule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@#$%^&*]).{8,}$/;

    if (!rule.test(newPassword)) {
      return res.status(400).json({ msg: "New password does not meet requirements" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await User.findOneAndUpdate({ name }, { password: hashedPassword });

    res.json({ msg: "Password changed successfully" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check Profile Completion
app.get("/api/checkProfile/:name", async (req, res) => {
  try {
    const user = await User.findOne({ name: req.params.name });

    if (!user) {
      return res.status(404).json({ profileCompleted: false });
    }

    res.json({ profileCompleted: !!user.profileCompleted });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
/* ---------------- SAVED ITEMS APIs ---------------- */

// Get saved items
app.get("/api/saved/:name", async (req, res) => {
  try {
    const user = await User.findOne({ name: req.params.name });
    if (!user) return res.status(404).json({ msg: "User not found" });
    res.json({ savedAcademies: user.savedAcademies || [], savedCompetitions: user.savedCompetitions || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Toggle save academy
app.post("/api/saved/academy", async (req, res) => {
  try {
    const { name, academyName } = req.body;
    const user = await User.findOne({ name });
    if (!user) return res.status(404).json({ msg: "User not found" });
    const idx = (user.savedAcademies || []).indexOf(academyName);
    if (idx === -1) {
      user.savedAcademies = [...(user.savedAcademies || []), academyName];
    } else {
      user.savedAcademies.splice(idx, 1);
    }
    await user.save();
    res.json({ saved: idx === -1, savedAcademies: user.savedAcademies });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Toggle save competition
app.post("/api/saved/competition", async (req, res) => {
  try {
    const { name, competitionId } = req.body;
    const user = await User.findOne({ name });
    if (!user) return res.status(404).json({ msg: "User not found" });
    const idx = (user.savedCompetitions || []).indexOf(competitionId);
    if (idx === -1) {
      user.savedCompetitions = [...(user.savedCompetitions || []), competitionId];
    } else {
      user.savedCompetitions.splice(idx, 1);
    }
    await user.save();
    res.json({ saved: idx === -1, savedCompetitions: user.savedCompetitions });
  } catch (err) { res.status(500).json({ error: err.message }); }
});



// ✅ ADD ADMIN APIs HERE
/* ---------------- ADMIN USER APIs ---------------- */

// GET ALL USERS
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE USER
app.delete("/api/users/:id", async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ msg: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// BAN USER
app.put("/api/users/ban/:id", async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { banned: true });
    res.json({ msg: "User banned successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// EDIT USER
app.put("/api/users/:id", async (req, res) => {
  try {
    const { name, email, phone, location, bio } = req.body;

    await User.findByIdAndUpdate(req.params.id, {
      name,
      email,
      phone,
      location,
      bio
    });

    res.json({ msg: "User updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}); 

// UNBAN USER
app.put("/api/users/unban/:id", async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { banned: false });
    res.json({ msg: "User unbanned successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN DASHBOARD STATS
app.get("/api/admin/stats", async (req, res) => {
  try {
    const users = await User.find();

    const totalUsers = users.length;
    const completedProfiles = users.filter(u => u.profileCompleted).length;

    const progressData = users.map(u => ({
      name: u.name,
      progress: u.profileCompleted ? 100 : 50
    }));

    res.json({
      totalUsers,
      completedProfiles,
      progressData
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------------- COMPETITION APIs ---------------- */

// GET all competitions
app.get("/api/competitions", async (req, res) => {
  try {
    const competitions = await Competition.find();
    res.json(competitions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/seedCompetitions", async (req, res) => {
  try {
    const data = require("./data_competitions_main.js");
    const extra = require("./data_competitions_extra.js");

    const all = [
      ...(data.MOCK_COMPETITIONS || []),
      ...(extra.EXTRA_COMPETITIONS || [])
    ];

    await Competition.deleteMany(); // optional reset
    await Competition.insertMany(all);

    res.json({ msg: "Competitions seeded successfully", count: all.length });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE competition (PERMANENT)
app.delete("/api/competitions/:id", async (req, res) => {
  try {
    await Competition.deleteOne({ id: req.params.id });
    res.json({ msg: "Competition deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/add-academies", async (req, res) => {
    try {
        await Academy.insertMany(req.body);
        res.json({ message: "Academies Added" });
    } catch (err) {
        res.status(500).json(err);
    }
});

app.get("/academies", async (req, res) => {
    const data = await Academy.find();
    res.json(data);
});

app.delete("/academy/:id", async (req, res) => {
    await Academy.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
});

app.put("/academy/:id", async (req, res) => {
    await Academy.findByIdAndUpdate(req.params.id, req.body);
    res.json({ message: "Updated" });
});

/* ---------------- ACADEMY SEED API ---------------- */

app.get("/api/seedAcademies", async (req, res) => {
  try {
    const { TECH_ACADEMIES } = require("./data_academies_technical");
    const { SPORTS_FITNESS_ACADEMIES } = require("./data_academies_sports_fitness");
    const { CREATIVE_ACADEMIES } = require("./data_academies_creative");
    const { LEGACY_ACADEMIES } = require("./data_academies_legacy");

    const all = [
      ...(TECH_ACADEMIES || []).map(a => ({ ...a, category: "technical" })),
      ...(CREATIVE_ACADEMIES || []).map(a => ({ ...a, category: "creative" })),
      ...(LEGACY_ACADEMIES || []).map(a => ({ ...a, category: "legacy" })),
      ...(SPORTS_FITNESS_ACADEMIES || []).map(a => ({ ...a, category: "sports" }))
    ];

    await Academy.deleteMany();
    await Academy.insertMany(all);

    res.json({ msg: "Academies seeded successfully", count: all.length });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* ---------------- Feedback APIs ---------------- */

// Submit Feedback
app.post("/api/feedback", async (req, res) => {
  try {
    const { name, email, message, rating } = req.body;

    // validation
    if (!name || !email || !rating) {
      return res.status(400).json({ msg: "Name, Email and Rating are required" });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ msg: "Rating must be between 1 and 5" });
    }

    const newFeedback = new Feedback({
      name,
      email,
      message: message || "",
      rating
    });

    await newFeedback.save();

    res.json({ msg: "Feedback submitted successfully" });

  } catch (err) {
    console.error("Feedback Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get All Feedback
app.get("/api/feedback", async (req, res) => {
  try {
    const feedbacks = await Feedback.find().sort({ createdAt: -1 });
    res.json(feedbacks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------------- START SERVER ---------------- */

const PORT = process.env.PORT || 3000;

mongoose
  .connect("mongodb://127.0.0.1:27017/eliteforge")
  .then(() => {
    console.log("MongoDB Connected");

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);

      const url = `http://localhost:${PORT}/landing_page.html`;

      const start =
        process.platform == "darwin"
          ? "open"
          : process.platform == "win32"
          ? "start"
          : "xdg-open";

      exec(`${start} ${url}`);
    });
  })
  .catch((err) => console.log(err));