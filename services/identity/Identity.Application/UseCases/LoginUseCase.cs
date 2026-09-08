using Identity.Application.Abstractions;
using Identity.Application.Contracts;
using Identity.Application.Exceptions;
using Identity.Domain.Repositories;

namespace Identity.Application.UseCases;

public interface ILoginUseCase
{
    Task<AuthenticatedResult> ExecuteAsync(LoginRequest request, CancellationToken ct = default);
}

public sealed class LoginUseCase : ILoginUseCase
{
    private readonly IUserRepository _users;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ITokenIssuer _tokenIssuer;

    public LoginUseCase(IUserRepository users, IPasswordHasher passwordHasher, ITokenIssuer tokenIssuer)
    {
        _users = users;
        _passwordHasher = passwordHasher;
        _tokenIssuer = tokenIssuer;
    }

    public async Task<AuthenticatedResult> ExecuteAsync(LoginRequest request, CancellationToken ct = default)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await _users.GetByEmailAsync(email, ct);
        if (user is null || !_passwordHasher.Verify(request.Password, user.PasswordHash))
            throw new InvalidCredentialsException();

        var token = _tokenIssuer.IssueAccessToken(user);
        return new AuthenticatedResult(token, new UserSummary(user.Id, user.Email, user.DisplayName));
    }
}
