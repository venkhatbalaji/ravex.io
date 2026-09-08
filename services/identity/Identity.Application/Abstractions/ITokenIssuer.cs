using Identity.Domain.Entities;

namespace Identity.Application.Abstractions;

public interface ITokenIssuer
{
    string IssueAccessToken(User user);
}
