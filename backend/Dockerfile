FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /build
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN sh ./mvnw -B -ntp -q dependency:go-offline
COPY src src
RUN sh ./mvnw -B -ntp -q package -DskipTests \
    && java -Djarmode=tools -jar target/portfolio-app-*.jar extract --layers --destination /extracted

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /extracted/dependencies/ ./
COPY --from=build /extracted/spring-boot-loader/ ./
COPY --from=build /extracted/snapshot-dependencies/ ./
COPY --from=build /extracted/application/ ./
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-Djava.io.tmpdir=/tmp", "-jar", "portfolio-app-0.0.1-SNAPSHOT.jar"]
