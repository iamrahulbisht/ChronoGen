# Schemas 

This document defines the data models used across ChronoGen's backend API.  
All schemas are built using **Pydantic** for validation and serialization.

---

## Institution

### Create
- `name`: string  
- `days_per_week`: int (default: 5)  
- `periods_per_day`: int (default: 8)  
- `period_duration_minutes`: int (default: 55)  
- `lunch_break_after_period`: int (default: 4)  

### Response
- `id`, `name`
- scheduling configuration fields
- `created_at`, `updated_at`

---

## Room

### Create
- `room_code`: string  
- `name`: string  
- `capacity`: int  
- `type`: classroom | lab | seminar_room | lecture_hall  

### Response
- `id`, `institution_id`
- room details
- `created_at`

---

## Teacher

### Create
- `teacher_code`: string  
- `name`: string  
- `teaches_subjects`: list[string]  
- `max_lectures_per_week`: int  
- `max_consecutive_lectures`: int  
- `unavailable_periods`: list[list[int]]  
- `prefers_morning`: bool  

### Response
- teacher details
- availability constraints
- timestamps

---

## Subject

### Create
- `subject_code`: string  
- `name`: string  
- `requires_room_type`: string  
- `min_lectures_per_week`: int  
- `is_lab`: bool  
- `is_split_allowed`: bool  

### Response
- subject metadata
- scheduling constraints

---

## Section (Class)

### Curriculum Entry
- `subject_id`: string  
- `teacher_id`: string  
- `min_per_week`: int  

### Create
- `section_code`: string  
- `name`: string  
- `student_count`: int  
- `fixed_classroom`: optional[string]  
- `fixed_lab`: optional[string]  
- `curriculum`: list[CurriculumEntry]  

### Response
- section details
- curriculum mapping
- timestamps

---

## Job (Timetable Generation)

### GA Configuration
- `population_size`: int  
- `max_generations`: int  
- `crossover_rate`: float  
- `mutation_rate`: float  
- `tournament_size`: int  
- `elitism_count`: int  
- `stagnation_window`: int  
- `target_fitness`: int  

### Create Job
- `institution_id`: string  
- `algorithm`: basic_ga | memetic_ga | island_ga | hyper_heuristic | nsga2  
- `ga_config`: configuration object  

---

### Job Result
- `fitness_score`
- `total_penalty`
- `generations_run`
- `constraint_breakdown`
- `fitness_history`
- `chromosome`
- `pareto_front`

---

### Constraint Breakdown
- Teacher clashes  
- Class clashes  
- Room clashes  
- Lab constraints  
- Missing lectures  
- Teacher overload  
- Gaps & preferences  

---

### Export Outputs
- student CSVs  
- teacher CSVs  
- room CSVs  
- chromosome JSON  
- convergence graph  
- HTML report  

---

## Timetable & Validation

### Slot Info
- `subject`  
- `teacher`  
- `room`  
- `is_lab`  

### Validation Response
- `valid`: bool  
- `errors`: list  
- `warnings`: list  

---

## Bulk Operations

Supported for:
- Sections  
- Rooms  
- Teachers  
- Subjects  

Allows efficient data ingestion via JSON payloads.

---

## Summary

ChronoGen’s schema design ensures:
- Strong validation using Pydantic  
- Clear separation of entities  
- Support for complex scheduling constraints  
- Scalable and structured data handling  
