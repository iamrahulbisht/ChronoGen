<h1 align="center">ChronoGen - A Genetic Algorithm Timetable Generator</h1>
<p align="center"><i>From Chaos to Clarity.</i></p>

## Inspiration
Every school or university has to build a timetable before each term starts. It sounds simple but when you start making a timetable with 30 classes, 60 teachers and 8 periods a day you realize it is one of the hardest scheduling problem that exists. While making a timetable the number of possible arrangements is larger than the number of atoms in the universe. You cannot try them all so you need to have a smarter way to do it.

## Demo Video


## Try it out


## What it Does

### Problem Statement

Making a timetable sounds easy, but it's actually a huge headache. You have to juggle teachers, students and classrooms, all while making sure that the timing works out.
One tiny mistake like putting two classes in the same room at the same time can mess up the whole week for everyone.
A lot of schools still try to do this by hand or with old fashioned spreadsheets. It take hours of hardword, double checking everything which is too frustrating for a human brain.

### ChronoGen's Solution

#### -Smart Scheduling with Genetic Algorithms
Traditional methods get stuck when there are too many constraints to handle.

**Our Solution:** ChronoGen uses a genetic algorithm to evolve the best schedule. It creates several versions of a timetable and constantly improves them through selection and mutation until it finds a perfect, conflict free result.

#### -Real World Constraint Management
Balancing teacher availability, subject requirements, and room allocation is complex.

**Our Solution:** The system is built to understand rules. It models everything from how many hours a teacher can work to specific subject requirements ensuring every schedule is actually practical for a real institution.

#### -Automatic conflict fixing
Fixing overlapping classes or room clashes usually takes hours of manual checking.

**Our Solution:** ChronoGen does the heavy lifting for you. It automatically spots and eliminates overlaps during the generation process, so you never have to worry about two classes fighting over the same room.

#### -Fast and Scalable Performance
As a school gets bigger, the scheduling "puzzle" gets exponentially harder to solve.

**Our Solution:** ChronoGen is built for speed. It can process large amounts of data and generate a high-quality, ready-to-use timetable in just a few seconds without any manual tweaking needed.

## How it Works

### -The User Side
**1. Institution Setup:** The user starts by defining their "world"—how many days a week they teach, how many periods are in a day, and when the lunch break happens. They can then manually add rooms, teachers, and subjects, or simply drag and drop a JSON file to populate everything instantly.

**2. Constraint Mapping:** This is where the human touch comes in. Users set specific "rules" for the AI to follow, such as marking exactly when a teacher is unavailable or deciding if a subject is a "Lab" (which automatically tells the system it needs two back-to-back slots).

**3. The "Evolutionary" Trigger:** The user chooses a Genetic Algorithm (like Island GA or NSGA-II) and hits "Generate." The frontend sends this request to the FastAPI backend, which creates a Job and immediately starts the heavy computation in the background.

**4. Live Progress Tracking:** While the GA is "evolving" the timetable, the user isn't left staring at a blank screen. The frontend polls the backend every 3 seconds, showing a live fitness chart and a breakdown of which constraints (like teacher clashes) are currently being fixed.

### -The Engine Side
**1. Config Building:** The backend pulls all those scattered MongoDB documents (teachers, rooms, sections) and assembles them into a single Config object that the Python GA engine can understand.

**2. Genetic Optimization:** The engine generates hundreds of random timetable "candidates." It then runs them through a cycle of Selection, Crossover, and Mutation. The "fittest" timetables (those with the fewest overlaps) survive and reproduce, while the "weak" ones are discarded.

**3. Conflict Resolution:** During every "generation," the system checks for hard constraints (e.g., Is Mr. Rahul in two rooms at once?) and soft constraints (e.g., Does this teacher have too many gaps in their day?). It assigns penalties for every violation, constantly trying to drive that penalty score to zero.

**4. Result Exporting:** Once a perfect (or near-perfect) solution is found, the backend saves the result as a Chromosome. It then generates a JSON grid for the UI and creates downloadable CSVs for every student, teacher, and room.

## System Architecture
<p align="center">
  <img src="https://github.com/user-attachments/assets/7bb9279e-3c64-4cf9-b51c-b9ebcecddc6d" width="800"/>
</p>

<p align="center"><i>ChronoGen System Architecture</i></p>

## What Sets ChronoGen Apart
**It actually "evolves" a solution:** Most scheduling tools just try to cram classes into empty slots and give up when they hit a conflict. ChronoGen uses Genetic Algorithms to test thousands of different schedules, combining the best parts of each until it finds a perfect, conflict-free fit.

**It understands real-world rules:** Making a schedule isn't just about finding empty rooms. The system knows the actual rules of a school—like the fact that a chemistry lab needs two back-to-back periods, or that a specific teacher can't be scheduled for 5 classes in a row.

**No more spreadsheet headaches:** What usually takes a human administrator days of frustrating, mind-numbing work now takes the computer just a few seconds. It doesn't matter if your school has 50 students or 5,000; the system handles it without breaking a sweat.

**You're never left in the dark:** Running a genetic algorithm takes some heavy lifting. Instead of freezing your screen with a boring loading spinner, the backend runs the math in the background and gives you a live dashboard so you can actually watch the schedule optimize in real-time.

## Technical Details
### API Routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/v1/institutions/{id}/import/json` | Bulk import all data (rooms, teachers, subjects, sections) |
| GET | `/api/v1/institutions/{id}/validate` | Validate constraints before running the algorithm |
| POST | `/api/v1/jobs` | Start timetable generation using genetic algorithms |
| GET | `/api/v1/jobs/{job_id}` | Get job status, fitness score, and progress |
| GET | `/api/v1/jobs/{job_id}/timetable` | Retrieve generated timetable as structured data |
| GET | `/api/v1/jobs/{job_id}/exports/all` | Download all outputs (CSV, charts, reports) |
