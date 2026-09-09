using System.Net;
using MarketCatalog.Application.Abstractions;
using MarketCatalog.Application.Exceptions;
using Microsoft.Extensions.Configuration;

namespace MarketCatalog.Infrastructure.Settlement;

public sealed class HttpStakeAdmission : IStakeAdmission, IDisposable
{
    private readonly HttpClient _client;

    public HttpStakeAdmission(IConfiguration configuration)
    {
        var key = configuration["INTERNAL_SERVICE_KEY"];
        if (string.IsNullOrWhiteSpace(key) || key.Length < 32)
            throw new InvalidOperationException("INTERNAL_SERVICE_KEY must contain at least 32 characters.");
        _client = new HttpClient
        {
            BaseAddress = new Uri(configuration["SETTLEMENT_SERVICE_URL"] ?? "http://localhost:5201"),
            Timeout = TimeSpan.FromSeconds(10)
        };
        _client.DefaultRequestHeaders.Add("X-Service-Key", key);
    }

    public async Task CloseAsync(Guid marketId, CancellationToken ct)
    {
        try
        {
            using var response = await _client.PostAsync($"/internal/pools/{marketId}/close", null, ct);
            if (response.StatusCode == HttpStatusCode.Conflict) throw new PendingStakesException();
            if (!response.IsSuccessStatusCode) throw new StakeAdmissionUnavailableException();
        }
        catch (HttpRequestException) { throw new StakeAdmissionUnavailableException(); }
        catch (TaskCanceledException) when (!ct.IsCancellationRequested) { throw new StakeAdmissionUnavailableException(); }
    }

    public void Dispose() => _client.Dispose();
}
