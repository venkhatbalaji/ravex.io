FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY services/shared/ services/shared/
COPY services/Directory.Build.props services/Directory.Build.props
COPY services/wallet-ledger/ services/wallet-ledger/
WORKDIR /src/services/wallet-ledger
RUN dotnet restore Wallet.Api/Wallet.Api.csproj
RUN dotnet publish Wallet.Api/Wallet.Api.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app .
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "Wallet.Api.dll"]
