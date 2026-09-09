FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY services/Directory.Build.props services/Directory.Build.props
COPY services/branding/ services/branding/
WORKDIR /src/services/branding
RUN dotnet restore Branding.Api/Branding.Api.csproj
RUN dotnet publish Branding.Api/Branding.Api.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app .
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "Branding.Api.dll"]
