import { describe, expect, it } from "vitest";
import { appRouter } from "./routers.js";
import type { TrpcContext } from "./_core/context.js";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(userId: number = 1): TrpcContext {
  const user: any = {
    id: userId,
    username: `test-user-${userId}`,
    name: `Test User ${userId}`,
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Boards Router", () => {
  it("should list boards for authenticated user", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.boards.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should create a new board", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.boards.create({
      name: "Test Board",
      description: "A test board",
      color: "#4b4897",
    });
    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
  });
});

describe("Lists Router", () => {
  it("should create a list in a board", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const boardRes = await caller.boards.create({
      name: "List Test Board",
      color: "#4b4897",
    });
    const result = await caller.lists.create({
      boardId: boardRes.id,
      name: "Test List",
    });
    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
  });
});

describe("Cards Router", () => {
  it("should create a card in a list", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const boardRes = await caller.boards.create({
      name: "Card Test Board",
      color: "#4b4897",
    });
    const listRes = await caller.lists.create({
      boardId: boardRes.id,
      name: "Test List",
    });
    const result = await caller.cards.create({
      listId: listRes.id,
      title: "Test Card",
      description: "A test card",
    });
    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
  });
});
