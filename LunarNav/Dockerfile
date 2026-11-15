# LunarNav API. Build context = the LunarNav folder:  docker build -t lunarnav-api LunarNav
FROM mcr.microsoft.com/dotnet/sdk:11.0 AS build
WORKDIR /src
COPY LunarNav.Core/LunarNav.Core.csproj LunarNav.Core/
COPY LunarNav.Api/LunarNav.Api.csproj LunarNav.Api/
RUN dotnet restore LunarNav.Api/LunarNav.Api.csproj
COPY LunarNav.Core/ LunarNav.Core/
COPY LunarNav.Api/ LunarNav.Api/
RUN dotnet publish LunarNav.Api/LunarNav.Api.csproj -c Release -o /app --no-restore

# LOLA terrain for POST /api/custom (115 MB, too big for git). If the download fails, only custom points are off (503).
RUN mkdir /dem && (curl -fsSL --retry 3 -o /dem/LDEM_80S_80M.IMG \
      https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_80s_80m.img \
    && [ "$(stat -c%s /dem/LDEM_80S_80M.IMG)" = 115520000 ] || rm -f /dem/LDEM_80S_80M.IMG)

FROM mcr.microsoft.com/dotnet/aspnet:11.0
WORKDIR /app
COPY --from=build /app .
COPY --from=build /dem/ /app/dem/
COPY LunarNav.Web/wwwroot/data/ /app/data/
ENV DataDir=/app/data \
    DemPath=/app/dem/LDEM_80S_80M.IMG \
    ASPNETCORE_HTTP_PORTS=10000 \
    ASPNETCORE_FORWARDEDHEADERS_ENABLED=true
EXPOSE 10000
USER app
ENTRYPOINT ["dotnet", "LunarNav.Api.dll"]
