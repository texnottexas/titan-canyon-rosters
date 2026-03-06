# Titan Canyon Rosters — Server 2864

A roster and battle plan hub for **Server 2864 Titan Canyon** in [Top War](https://rivergame.net/). View squad rosters, compare player stats, and check the latest battle plan assignments — all from one page.

**Live site:** [test.2864tw.com](https://test.2864tw.com)

---

## Pages

### Roster (`index.html`)

The main roster page lists every player in the server with key stats:

- **Name, Squad, Alliance, Unit, and Profession** (Combat Elite / Mechanical Masters)
- **March CP** with a visual power bar for quick comparison
- **Availability flags** — icons indicate schedule availability across time slots

Use the **search bar** to find players by name, or the **filter buttons** to narrow by squad, profession, or alliance.

### Battle Plan (`battle-plan.html`)

A visual battle map showing the current Titan Canyon assignments for each squad:

- **Diamond grid** with 8 numbered positions — positions 1–2 are Combat Elite, 3–8 are Mechanical Masters
- **Role sections** below the map list Goon, Standby, Hover, and Crystal assignments
- Click any squad tab to switch between squad plans

### Admin Editor (`admin.html`)

A password-protected editor for managing battle plans and the player roster. Admins can:

- **Assign players to map positions** by clicking nodes on the diamond grid or using the sidebar dropdowns — only eligible professions appear (CE for positions 1–2, MM for 3–8)
- **Fill support roles** (Goon, Standby, Hover, Crystal) with add/remove slot controls
- **Add, edit, or remove players** from the server roster — changes sync to the live roster page
- Players already assigned to a position are automatically hidden from other dropdowns to prevent duplicates

All changes are saved back to the repository and go live on the site automatically.

---

## File Structure

| File | Description |
|---|---|
| `index.html` | Main roster page |
| `battle-plan.html` | Battle plan viewer |
| `admin.html` | Admin editor (password-protected) |
| `roster-data.json` | Player roster data |
| `battle-plan-data.json` | Battle plan assignments per squad |
| `worker/` | Cloudflare Worker that handles authenticated saves |
| `CNAME` | Custom domain config for GitHub Pages |

---

## How It Works

The site is hosted on **GitHub Pages**. Roster and battle plan data are stored as JSON files in the repository. The admin editor writes changes through a **Cloudflare Worker** proxy that commits updates directly to the repo — no traditional backend required.

When an admin saves changes, the updated JSON is committed to the repository and GitHub Pages automatically serves the new data.
