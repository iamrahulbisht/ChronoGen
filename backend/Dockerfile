# Use a small, official Python image
FROM python:3.11-slim

# Set working directory inside the container
WORKDIR /app

# Install runtime dependencies (only pip is needed)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend source code (everything under backend/)
COPY backend/ .

# Expose the port FastAPI will run on
EXPOSE 8000

# Start the app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
