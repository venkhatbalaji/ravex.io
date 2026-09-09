namespace Identity.Domain.Entities;

public enum UserRole
{
    Player,
    Admin
}

public class User
{
    public Guid Id { get; private set; }
    public string Email { get; private set; } = string.Empty;
    public string DisplayName { get; private set; } = string.Empty;
    public string PasswordHash { get; private set; } = string.Empty;
    public UserRole Role { get; private set; } = UserRole.Player;
    public DateTimeOffset CreatedAt { get; private set; }

    private User()
    {
        // required by EF Core for materialization
    }

    /// <summary>Public self-registration — always a Player. Never accepts a
    /// caller-supplied role; an Admin account can only come from RegisterAdmin.</summary>
    public static User Register(string email, string displayName, string passwordHash) =>
        Create(email, displayName, passwordHash, UserRole.Player);

    /// <summary>Only called from Identity's controlled startup bootstrap
    /// (ADMIN_BOOTSTRAP_EMAIL/PASSWORD) — never reachable from a public endpoint.</summary>
    public static User RegisterAdmin(string email, string displayName, string passwordHash) =>
        Create(email, displayName, passwordHash, UserRole.Admin);

    private static User Create(string email, string displayName, string passwordHash, UserRole role)
    {
        if (string.IsNullOrWhiteSpace(email))
            throw new ArgumentException("Email is required.", nameof(email));
        if (string.IsNullOrWhiteSpace(passwordHash))
            throw new ArgumentException("A password hash is required.", nameof(passwordHash));

        var normalizedEmail = email.Trim().ToLowerInvariant();

        return new User
        {
            Id = Guid.NewGuid(),
            Email = normalizedEmail,
            DisplayName = string.IsNullOrWhiteSpace(displayName) ? normalizedEmail.Split('@')[0] : displayName,
            PasswordHash = passwordHash,
            Role = role,
            CreatedAt = DateTimeOffset.UtcNow
        };
    }
}
