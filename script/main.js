const line = document.querySelector(".graph-line");
const glow = document.querySelector(".graph-glow");

const WIDTH = 500;
const HEIGHT = 300;

const POINTS = 14;
const STEP = WIDTH / (POINTS - 1);

let points = [];


// ===============================
// INITIAL DATA
// ===============================

let y = 160;

for (let i = 0; i < POINTS; i++) {

    y += (Math.random() - 0.5) * 35;

    y = Math.max(55, Math.min(245, y));

    points.push({
        x: i * STEP,
        y: y
    });
}


// ===============================
// CREATE PATH
// ===============================

function draw() {

    if (points.length < 2) return;

    let path =
        `M ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length; i++) {

        path +=
            ` L ${points[i].x} ${points[i].y}`;
    }

    line.setAttribute("d", path);
    glow.setAttribute("d", path);
}


// ===============================
// NEW DATA POINT
// ===============================

function createNewPoint() {

    const last =
        points[points.length - 1];

    let change =
        (Math.random() - 0.5) * 65;

    let targetY =
        last.y + change;

    targetY =
        Math.max(
            45,
            Math.min(255, targetY)
        );

    return targetY;
}


// ===============================
// SMOOTH ANIMATION
// ===============================

let targetY = createNewPoint();

let lastTime = performance.now();

function animate(time) {

    const delta =
        Math.min((time - lastTime) / 1000, 0.05);

    lastTime = time;


    // Move graph slowly to the left

    const speed = 65;

    for (const point of points) {

        point.x -= speed * delta;
    }


    // Smoothly move newest point
    // toward its target

    const last =
        points[points.length - 1];

    last.y +=
        (targetY - last.y) *
        Math.min(delta * 5, 1);


    // When old point leaves screen
    // create a new one

    if (points[0].x < -STEP) {

        points.shift();

        const previous =
            points[points.length - 1];

        targetY = createNewPoint();

        points.push({

            x: WIDTH,

            y: previous.y
        });
    }


    draw();

    requestAnimationFrame(animate);
}


draw();

requestAnimationFrame(animate);

// ===== CONTRIBUTION GRAPH =====

(function buildTracker() {
    'use strict';

    const WORKER_URL = 'https://coder-site.tasin-abir10941455.workers.dev/';
    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const CELL = 14, GAP = 4, STEP = CELL + GAP;

    // Visual day order: Mon=0, Tue=1, ..., Sun=6
    // GitHub weekday: 0=Sun, 1=Mon, ..., 6=Sat
    // Visual row index for a GitHub weekday:
    function visualRow(githubWeekday) {
        // Mon→0, Tue→1, Wed→2, Thu→3, Fri→4, Sat→5, Sun→6
        return (githubWeekday + 6) % 7;
    }

    const grid      = document.getElementById('tracker-grid');
    const monthsRow = document.getElementById('tracker-months');
    const tooltip   = document.getElementById('tracker-tooltip');

    if (!grid || !monthsRow || !tooltip) return;

    // ── Show loading state ─────────────────────────────────────
    function showLoading() {
        grid.innerHTML = '';
        monthsRow.innerHTML = '';
        const msg = document.createElement('div');
        msg.className = 'tracker-state-msg';
        msg.textContent = 'Loading contributions…';
        grid.parentElement.insertBefore(msg, grid);
        grid.style.display = 'none';
    }

    // ── Show error state ───────────────────────────────────────
    function showError(err) {
        console.error('[Tracker] Failed to load GitHub contributions:', err);
        const existing = grid.parentElement.querySelector('.tracker-state-msg');
        if (existing) existing.remove();
        const msg = document.createElement('div');
        msg.className = 'tracker-state-msg error';
        msg.textContent = 'Unable to load GitHub contributions.';
        grid.parentElement.insertBefore(msg, grid);
        grid.style.display = 'none';
    }

    // ── Remove loading state ───────────────────────────────────
    function clearLoading() {
        const existing = grid.parentElement.querySelector('.tracker-state-msg');
        if (existing) existing.remove();
        grid.style.display = '';
    }

    // ── Extract contributionCalendar from whatever shape the Worker returns
    function extractCalendar(json) {
        // Try: json.data.user.contributionsCollection.contributionCalendar
        if (json?.data?.user?.contributionsCollection?.contributionCalendar) {
            return json.data.user.contributionsCollection.contributionCalendar;
        }
        // Try: json.contributionsCollection.contributionCalendar
        if (json?.contributionsCollection?.contributionCalendar) {
            return json.contributionsCollection.contributionCalendar;
        }
        // Try: json.contributionCalendar
        if (json?.contributionCalendar) {
            return json.contributionCalendar;
        }
        return null;
    }

    // ── Map GitHub level string → numeric level ────────────────
    function levelNum(levelStr) {
        switch (levelStr) {
            case 'FIRST_QUARTILE':  return 1;
            case 'SECOND_QUARTILE': return 2;
            case 'THIRD_QUARTILE':  return 3;
            case 'FOURTH_QUARTILE': return 4;
            default:                return 0; // NONE or unknown
        }
    }

    // ── Format date string "YYYY-MM-DD" → "Aug 25, 2026" ──────
    function formatDate(dateStr) {
        // Parse as local date to avoid timezone-shifted display
        const [y, m, d] = dateStr.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        return date.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
    }

    // ── Render the contribution graph from real GitHub data ────
    function renderCalendar(calendar) {
        const weeks = calendar.weeks;
        if (!weeks || weeks.length === 0) {
            showError(new Error('No weeks in calendar'));
            return;
        }

        // Clear any previous content
        grid.innerHTML = '';
        monthsRow.innerHTML = '';

        let lastLabelMonth = -1;
        let weekIndex = 0;

        for (const week of weeks) {
            const days = week.contributionDays;

            // Build a map: visual row (0–6) → day data
            // A week from the API may have < 7 days (at the start/end of the range)
            const rowMap = {};
            for (const day of days) {
                rowMap[visualRow(day.weekday)] = day;
            }

            // Month label: check the first day of this week
            // Use the first available day in the week for month detection
            if (days.length > 0) {
                const firstDay = days[0];
                const month = parseInt(firstDay.date.split('-')[1], 10) - 1;
                if (month !== lastLabelMonth) {
                    const span = document.createElement('span');
                    span.className = 'tracker-month-label';
                    span.textContent = MONTH_NAMES[month];
                    span.style.left = (weekIndex * STEP) + 'px';
                    monthsRow.appendChild(span);
                    lastLabelMonth = month;
                }
            }

            // Render 7 cells for this week column (rows 0–6 = Mon–Sun)
            for (let row = 0; row < 7; row++) {
                const cell = document.createElement('div');
                cell.className = 'tracker-cell';

                const day = rowMap[row];

                if (day) {
                    const level = levelNum(day.contributionLevel);
                    cell.classList.add('level-' + level);

                    const dateLabel  = formatDate(day.date);
                    const count      = day.contributionCount;
                    const countLabel = count === 0
                        ? 'No contributions'
                        : count + ' contribution' + (count === 1 ? '' : 's');

                    cell.addEventListener('mouseenter', () => {
                        tooltip.innerHTML =
                            '<div class="tt-date">'  + dateLabel  + '</div>' +
                            '<div class="tt-count">' + countLabel + '</div>';
                        tooltip.classList.add('visible');
                    });

                    cell.addEventListener('mousemove', (e) => {
                        let tx = e.clientX + 12;
                        let ty = e.clientY - 48;
                        if (tx + 180 > window.innerWidth)  tx = e.clientX - 175;
                        if (ty < 8)                         ty = e.clientY + 16;
                        tooltip.style.left = tx + 'px';
                        tooltip.style.top  = ty + 'px';
                    });

                    cell.addEventListener('mouseleave', () => {
                        tooltip.classList.remove('visible');
                    });
                } else {
                    // Padding cell — no data for this row in a partial week
                    cell.classList.add('empty');
                }

                grid.appendChild(cell);
            }

            weekIndex++;
        }

        // Size the months row to match the grid width exactly
        monthsRow.style.width = (weekIndex * STEP - GAP) + 'px';
    }

    // ── Fetch and kick off rendering ───────────────────────────
    showLoading();

    fetch(WORKER_URL)
        .then(function(res) {
            if (!res.ok) throw new Error('Worker responded with HTTP ' + res.status);
            return res.json();
        })
        .then(function(json) {
            const calendar = extractCalendar(json);
            if (!calendar) {
                throw new Error('Could not find contributionCalendar in response: ' + JSON.stringify(json).slice(0, 200));
            }
            clearLoading();
            renderCalendar(calendar);
        })
        .catch(function(err) {
            showError(err);
        });

})();


const revealTargets = document.querySelectorAll(
    ".who-i-am, .featured-work, .notes, .achievements, .tools, .tracker, .contact-me"
);

revealTargets.forEach(el => el.classList.add("reveal"));

const revealObserver = new IntersectionObserver((entries) => {

    entries.forEach(entry => {

        if (entry.isIntersecting) {

            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);

        }

    });

}, { threshold: 0.15 });

revealTargets.forEach(el => revealObserver.observe(el));