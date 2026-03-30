<h1 align="center">ChronoGen - A Genetic Algorithm Timetable Generator</h1>
<p align="center"><i>Making scheduling less painful</i></p>

## Inspiration
Every school or university has to build a timetable before each term starts. It sounds simple but when you start making a timetable with 30 classes, 60 teachers and 8 periods a day you realize it is one of the hardest scheduling problem that exists. While making a timetable the number of possible arrangements is larger than the number of atoms in the universe. You cannot try them all so you need to have a smarter way to do it.

## Demo Video
<p align="center">
  <a href="[https://drive.google.com/drive/folders/17j2ZZcrvy82ucgfOgG_CCnRHSkEKyCfH](https://drive.google.com/file/d/1Ni8MpM0kU0UOibMzWklJEYOF5pD1WHh5/view?usp=drivesdk)" target="_blank">
    <img src="https://img.shields.io/badge/Watch%20Demo-Video-blue?style=for-the-badge" />
  </a>
</p>

## Try ChronoGen here
[https://return0-chronogen.vercel.app/](https://return0-chronogen.vercel.app/)

## What it Does

### Problem Statement

Making a timetable sounds easy, but it's actually a huge headache. You have to juggle teachers, students and classrooms, all while making sure that the timing works out.
One tiny mistake like putting two classes in the same room at the same time can mess up the whole week for everyone.
A lot of schools still try to do this by hand or with old fashioned spreadsheets. It take hours of hardword, double checking everything which is too frustrating for a human brain.

### ChronoGen's Solution

- #### Smart Scheduling with Genetic Algorithms
Traditional methods get stuck when there are too many constraints to handle.

**Our Solution:** ChronoGen uses a genetic algorithm to evolve the best schedule. It creates several versions of a timetable and constantly improves them through selection and mutation until it finds a perfect, conflict free result.

- #### Real World Constraint Management
Balancing teacher availability, subject requirements, and room allocation is complex.

**Our Solution:** The system is built to understand rules. It models everything from how many hours a teacher can work to specific subject requirements ensuring every schedule is actually practical for a real institution.

- #### Automatic conflict fixing
Fixing overlapping classes or room clashes usually takes hours of manual checking.

**Our Solution:** ChronoGen does the heavy lifting for you. It automatically spots and eliminates overlaps during the generation process, so you never have to worry about two classes fighting over the same room.

- #### Fast and Scalable Performance
As a school gets bigger, the scheduling "puzzle" gets exponentially harder to solve.

**Our Solution:** ChronoGen is built for speed. It can process large amounts of data and generate a high-quality, ready-to-use timetable in just a few seconds without any manual tweaking needed.

## How it Works

- ### The User Side
**1. Institution Setup:** The user starts by defining their "world"—how many days a week they teach, how many periods are in a day, and when the lunch break happens. They can then manually add rooms, teachers, and subjects, or simply drag and drop a JSON file to populate everything instantly.

**2. Constraint Mapping:** This is where the human touch comes in. Users set specific "rules" for the AI to follow, such as marking exactly when a teacher is unavailable or deciding if a subject is a "Lab" (which automatically tells the system it needs two back-to-back slots).

**3. The "Evolutionary" Trigger:** The user chooses a Genetic Algorithm (like Island GA or NSGA-II) and hits "Generate." The frontend sends this request to the FastAPI backend, which creates a Job and immediately starts the heavy computation in the background.

**4. Live Progress Tracking:** While the GA is "evolving" the timetable, the user isn't left staring at a blank screen. The frontend polls the backend every 3 seconds, showing a live fitness chart and a breakdown of which constraints (like teacher clashes) are currently being fixed.

- ### The Engine Side
**1. Config Building:** The backend pulls all those scattered MongoDB documents (teachers, rooms, sections) and assembles them into a single Config object that the Python GA engine can understand.

**2. Genetic Optimization:** The engine generates hundreds of random timetable "candidates." It then runs them through a cycle of Selection, Crossover, and Mutation. The "fittest" timetables (those with the fewest overlaps) survive and reproduce, while the "weak" ones are discarded.

**3. Conflict Resolution:** During every "generation," the system checks for hard constraints (e.g., Is Mr. Rahul in two rooms at once?) and soft constraints (e.g., Does this teacher have too many gaps in their day?). It assigns penalties for every violation, constantly trying to drive that penalty score to zero.

**4. Result Exporting:** Once a perfect (or near-perfect) solution is found, the backend saves the result as a Chromosome. It then generates a JSON grid for the UI and creates downloadable CSVs for every student, teacher, and room.

## System Architecture
<p align="center">
  <img src="https://github.com/user-attachments/assets/7bb9279e-3c64-4cf9-b51c-b9ebcecddc6d" width="800"/>
</p>

<p align="center"><i>ChronoGen System Architecture</i></p>

## Flowchart
<p align="center">
  <img src="https://github.com/user-attachments/assets/7cd040d1-3f07-492c-a0ef-8177172d976f" width="800"/>
</p>

<p align="center"><i>ChronoGen System Architecture</i></p>

## Algorithm Comparison

Different institutions have different levels of scheduling complexity. ChronoGen provides multiple algorithm options instead of forcing a one-size-fits-all approach.

### Which algorithm to use?

| Algorithm | How it Works | Strengths | Trade-offs | Best For |
|----------|-------------|-----------|------------|----------|
| **Basic GA** | Standard evolutionary loop (selection, crossover, mutation) | Very fast and simple | Can get stuck in local optima | Small institutions with simple constraints |
| **Memetic GA** | GA combined with local search refinement | High accuracy, improves near-perfect solutions | Slower due to extra optimization step | When Basic GA gets close but not perfect |
| **Island GA** | Multiple populations evolve independently and exchange solutions | High diversity, avoids stagnation | Requires more memory and compute | Large, complex institutions |
| **Hyper-Heuristic** | Self-adjusting mutation and crossover strategies | No tuning needed, adaptive | Slightly unpredictable convergence time | Users who want automatic optimization |
| **NSGA-II** | Multi-objective optimization (hard vs soft constraints) | Provides multiple optimal solutions (Pareto front) | Highest computational cost | When balancing trade-offs is important |

## Comparision Graph
<p align="center">
  <img src="https://github.com/user-attachments/assets/070f1464-bf68-4674-8480-01c24ff8be7c" width="800"/>
</p>

<p align="center"><i>Basic GA vs Memetic GA</i></p>

## Constraints breakdown
<p align="center">
  <img src="https://github.com/user-attachments/assets/30d9d08a-3b15-4007-a8b5-bc5b14a3c272" width="800"/>
</p>

<p align="center"><i>Constraints</i></p>

## What Sets ChronoGen Apart
- **It actually "evolves" a solution:** Most scheduling tools just try to cram classes into empty slots and give up when they hit a conflict. ChronoGen uses Genetic Algorithms to test thousands of different schedules, combining the best parts of each until it finds a perfect, conflict-free fit.

- **It understands real-world rules:** Making a schedule isn't just about finding empty rooms. The system knows the actual rules of a school—like the fact that a chemistry lab needs two back-to-back periods, or that a specific teacher can't be scheduled for 5 classes in a row.

- **No more spreadsheet headaches:** What usually takes a human administrator days of frustrating, mind-numbing work now takes the computer just a few seconds. It doesn't matter if your school has 50 students or 5,000; the system handles it without breaking a sweat.

- **You're never left in the dark:** Running a genetic algorithm takes some heavy lifting. Instead of freezing your screen with a boring loading spinner, the backend runs the math in the background and gives you a live dashboard so you can actually watch the schedule optimize in real-time.

## Technical Details

- **Import and Check Data:** Institutional data can be uploaded in bulk as JSON, and one of the FastAPI routes will see if there are any impossible combinations of scheduling rules before allocate any compute power.

- **Cache State:** The React front end stores the context of the selected institution in Zustand, so that all operations can be executed concurrently with MongoDB.

- **Process in Background:** All long-running mathematical operations using the genetic algorithm are executed in the background by FastAPI workers, allowing the user to see the results quickly, even though the math is still being calculated.

- **Create Schedules:** The backend is responsible for selecting, crossing, and mutating all of the timetable options until a perfect schedule is created.

- **Penalty Points:** The customized fitness function in the backend assigns penalty points for Hard constraints (e.g., double-booked rooms) and Soft constraints (e.g., gaps in the schedule), resulting in a final conflict score of zero.

- **Update in Real Time:** A customized React hook polls the backend every three seconds and updates the Recharts the user is viewing, so that they can see the progress of the genetic algorithm in real time.

- **Export Options:** The winning schedule will be displayed as an interactive grid in the UI and a ZIP file containing CSV files, json, html and png format for the classes, teachers, and rooms purchased by the user will be created.
  
### API Routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/v1/institutions/{id}/import/json` | Bulk import all data (rooms, teachers, subjects, sections) |
| GET | `/api/v1/institutions/{id}/validate` | Validate constraints before running the algorithm |
| POST | `/api/v1/jobs` | Start timetable generation using genetic algorithms |
| GET | `/api/v1/jobs/{job_id}` | Get job status, fitness score, and progress |
| GET | `/api/v1/jobs/{job_id}/timetable` | Retrieve generated timetable as structured data |
| GET | `/api/v1/jobs/{job_id}/exports/all` | Download all outputs (CSV, charts, reports) |

## Performance benchmarks
- **Small Departments (up to 10 teachers):** Usually done in under 10 seconds.
- **Average High Schools (30+ teachers):** Typically takes 1 to 2 minutes to find a conflict-free result.
- **Large Colleges (80+ teachers):** Can take 3 to 5 minutes to solve the most complex puzzles.

## Real-World Edge Cases 

- **Early Validation** – Detects impossible schedules before running the algorithm  
- **Lab Continuity** – Keeps long sessions (like labs) uninterrupted  
- **Teacher Availability** – Respects blocked time slots and part-time schedules  
- **Gap Minimization** – Reduces unnecessary idle periods in a teacher’s day  
- **Stagnation Handling** – Explores new solutions when optimization gets stuck  


### Tech Stack

**Frontend**
* **React 19 & TypeScript:** For a robust, type-safe user interface.
* **Vite:** For lightning-fast local development and optimized builds.
* **Tailwind CSS:** For precise, custom styling and an industrial, data-heavy design system.
* **Zustand:** For lightweight, persistent state management (handling institutional context).
* **TanStack Query (React Query):** For server-state caching and seamless API synchronization.
* **Recharts:** For rendering live, real-time fitness convergence and penalty breakdown charts.

**Backend**
* **FastAPI:** High-performance, asynchronous Python framework for handling API routes and background tasks.
* **Python 3.10+:** The core language powering the routing and the evolutionary engine.
* **Pydantic:** For strict data validation and parsing between the API and the GA engine.
* **Matplotlib:** Used internally to generate downloadable `.png` convergence plots.

**Database & Storage**
* **MongoDB:** A NoSQL database chosen specifically for its flexibility in storing complex, nested curriculum and constraint data.
* **Motor / PyMongo:** For asynchronous and synchronous database operations.

**The Engine**
* **Custom Genetic Algorithms:** Implements multiple evolutionary strategies including Basic GA, Memetic GA, Island GA, and NSGA-II (for multi-objective Pareto optimization).
