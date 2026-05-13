# Stage 1: Build the application using Maven
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app

# Copy the pom.xml file to download dependencies
COPY pom.xml .
# Download dependencies (this step is cached unless pom.xml changes)
RUN mvn dependency:go-offline -B

# Copy the actual source code
COPY src ./src

# Build the application, skipping tests for faster deployment
RUN mvn clean package -DskipTests

# Stage 2: Create the production image
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Expose the port your Spring Boot app runs on
EXPOSE 8081

# Copy the generated JAR file from the build stage
COPY --from=build /app/target/*.jar app.jar

# Set default Spring profile to prod
ENV SPRING_PROFILES_ACTIVE=prod

# Run the Spring Boot application
ENTRYPOINT ["java", "-jar", "app.jar"]