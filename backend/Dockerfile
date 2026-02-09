# Build stage
FROM maven:3-eclipse-temurin-21 AS build
WORKDIR /workspace

COPY pom.xml .
RUN mvn -q -DskipTests dependency:go-offline

COPY src ./src
RUN mvn -q -DskipTests package

# Run stage
FROM eclipse-temurin:21-jre
WORKDIR /app

# 不写死 jar 名称：复制生成出来的主 jar
COPY --from=build /workspace/target/app.jar /app/app.jar

EXPOSE 5091
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
