using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MarketCatalog.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class MarketResolution : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ResolutionRequestedAt",
                schema: "market_catalog",
                table: "markets",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ResolvedAt",
                schema: "market_catalog",
                table: "markets",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ResolvedBy",
                schema: "market_catalog",
                table: "markets",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ResultSource",
                schema: "market_catalog",
                table: "markets",
                type: "character varying(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ResolutionRequestedAt",
                schema: "market_catalog",
                table: "markets");

            migrationBuilder.DropColumn(
                name: "ResolvedAt",
                schema: "market_catalog",
                table: "markets");

            migrationBuilder.DropColumn(
                name: "ResolvedBy",
                schema: "market_catalog",
                table: "markets");

            migrationBuilder.DropColumn(
                name: "ResultSource",
                schema: "market_catalog",
                table: "markets");
        }
    }
}
