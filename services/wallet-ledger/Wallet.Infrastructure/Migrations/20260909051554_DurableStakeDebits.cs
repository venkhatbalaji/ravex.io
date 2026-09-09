using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wallet.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DurableStakeDebits : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "stake_debits",
                schema: "wallet",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    MarketId = table.Column<Guid>(type: "uuid", nullable: false),
                    OutcomeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Amount = table.Column<long>(type: "bigint", nullable: false),
                    Accepted = table.Column<bool>(type: "boolean", nullable: false),
                    Balance = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stake_debits", x => x.Id);
                    table.CheckConstraint("stake_debit_positive", "\"Amount\" > 0");
                });

            migrationBuilder.CreateIndex(
                name: "IX_stake_debits_UserId_CreatedAt",
                schema: "wallet",
                table: "stake_debits",
                columns: new[] { "UserId", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "stake_debits",
                schema: "wallet");
        }
    }
}
