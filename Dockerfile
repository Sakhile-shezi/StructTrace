# ==========================================
# STRUCTTRACE - DOCKER BUILD
# ASP.NET CORE 10
# ==========================================

# STAGE 1: BUILD
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build

WORKDIR /src

# Copy project file
COPY ["StructTrace.Web/StructTrace.Web.csproj", "StructTrace.Web/"]

# Restore NuGet dependencies
RUN dotnet restore "StructTrace.Web/StructTrace.Web.csproj"

# Copy application source code
COPY . .

WORKDIR /src/StructTrace.Web

# Publish application
RUN dotnet publish "StructTrace.Web.csproj" \
    --configuration Release \
    --output /app/publish \
    /p:UseAppHost=false \
    --no-restore


# ==========================================
# STAGE 2: PRODUCTION RUNTIME
# ==========================================

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final

WORKDIR /app

# Copy published application
COPY --from=build /app/publish .

# Production environment
ENV ASPNETCORE_ENVIRONMENT=Production

# Render application port
EXPOSE 10000

# Listen on Render's assigned port
ENTRYPOINT ["sh", "-c", "exec dotnet StructTrace.Web.dll --urls http://0.0.0.0:${PORT:-10000}"]
