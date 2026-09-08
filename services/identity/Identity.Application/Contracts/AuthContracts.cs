namespace Identity.Application.Contracts;

public record RegisterUserRequest(string Email, string Password, string? DisplayName);
public record LoginRequest(string Email, string Password);
public record UserSummary(Guid Id, string Email, string DisplayName);
public record AuthenticatedResult(string AccessToken, UserSummary User);
