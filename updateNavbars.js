const fs = require('fs');
const path = require('path');

const targetFiles = [
    'index.html',
    'academy_finder.html',
    'competition_tracker.html',
    'dashboard.html',
    'deadline.html',
    'help_feedback.html'
];

const scriptToInject = `
<!-- Global Navbar Profile Picture Logic -->
<script>
document.addEventListener("DOMContentLoaded", async () => {
    const u = localStorage.getItem("username");
    if (u) {
        try {
            const res = await fetch(\`http://localhost:3000/profile/\${u}\`);
            if (res.ok) {
                const data = await res.json();
                if (data.profilePic && data.profilePic.startsWith("data:")) {
                    const pic = document.getElementById("navProfilePic");
                    const icon = document.getElementById("navProfileIcon");
                    if (pic && icon) {
                        pic.src = data.profilePic;
                        pic.style.display = "block";
                        icon.style.display = "none";
                    }
                }
            }
        } catch(e) { console.error("Error fetching global profile pic", e); }
    }
});
</script>
`;

const replaceHtml = `
                    <img id="navProfilePic" src="https://img.freepik.com/premium-vector/avatar-profile-icon-flat-style-female-user-profile-vector-illustration-isolated-background-women-profile-sign-business-concept_157943-38866.jpg" alt="Profile" style="width: 32px; height: 32px; border-radius: 50%; display: none; margin-right: 8px; border: 2px solid white; object-fit: cover;">
                    <i class="fas fa-user-circle fa-lg text-white me-2" id="navProfileIcon"></i>
                    <span class="text-white fw-semibold me-1" id="navUsername">Profile</span>
`.trim();

targetFiles.forEach(file => {
    let p = path.join(__dirname, file);
    if (fs.existsSync(p)) {
        let content = fs.readFileSync(p, 'utf8');

        // Replace the user icon HTML
        const searchRegex = /<i class="fas fa-user-circle fa-lg text-white me-2"><\/i>\s*<span class="text-white fw-semibold me-1" id="navUsername">Profile<\/span>/;
        if (searchRegex.test(content)) {
            content = content.replace(searchRegex, replaceHtml);
        }

        // Inject the script before </body>
        if (!content.includes('Global Navbar Profile Picture Logic')) {
            content = content.replace('</body>', scriptToInject + '\n</body>');
        }

        fs.writeFileSync(p, content, 'utf8');
        console.log("Updated " + file);
    } else {
        console.log("File not found " + file);
    }
});
