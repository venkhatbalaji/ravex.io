using Identity.Application.Abstractions;
using Identity.Application.Contracts;
using Identity.Application.Exceptions;
using Identity.Domain.Entities;
using Identity.Domain.Repositories;

namespace Identity.Application.UseCases;

public interface IRegisterUserUseCase
{
    Task<UserSummary> ExecuteAsync(RegisterUserRequest request, CancellationToken ct = default);
}

public sealed class RegisterUserUseCase : IRegisterUserUseCase
{
    private readonly IUserRepository _users;
    private readonly IPasswordHasher _passwordHasher;

    public RegisterUserUseCase(IUserRepository users, IPasswordHasher passwordHasher)
    {
        _users = users;
        _passwordHasher = passwordHasher;
    }

    public async Task<UserSummary> ExecuteAsync(RegisterUserRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 8)
            throw new WeakPasswordException();

        var email = request.Email.Trim().ToLowerInvariant();
        if (await _users.ExistsByEmailAsync(email, ct))
            throw new EmailAlreadyRegisteredException(email);

        var user = User.Register(email, request.DisplayName ?? string.Empty, _passwordHasher.Hash(request.Password));
        await _users.AddAsync(user, ct);

        return new UserSummary(user.Id, user.Email, user.DisplayName, user.Role.ToString());
    }
}
