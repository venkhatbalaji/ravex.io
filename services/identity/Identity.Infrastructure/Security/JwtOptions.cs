namespace Identity.Infrastructure.Security;

public sealed class JwtOptions
{
    public const string Issuer = "ravex-identity";
    public const string Audience = "ravex-platform";

    public required string SigningKey { get; init; }
    public int ExpiryHours { get; init; } = 12;
}
