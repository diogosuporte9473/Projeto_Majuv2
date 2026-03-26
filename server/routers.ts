// ==================== MAIN APP ROUTER (CORRIGIDO) ====================

export const appRouter = router({
  system: systemRouter,
  audit: auditRouter,
  boardMirrorSettings: boardMirrorSettingsRouter,

  auth: router({
    me: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return null;
      const { password, ...userWithoutPassword } = ctx.user;
      return userWithoutPassword;
    }),

    login: publicProcedure
      .input(z.object({ username: z.string(), password: z.string() }))
      .mutation(/* seu código completo de login aqui */),

    register: publicProcedure
      .input(z.object({ 
        username: z.string(), 
        password: z.string(), 
        name: z.string().optional() 
      }))
      .mutation(/* seu código completo de register aqui */),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    }),
  }),

  // ==================== ADMIN (ÚNICA DECLARAÇÃO) ====================
  admin: router({
    users: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem listar usuários' });
        }
        const { data, error } = await supabase.from("users").select("id, username, name, role, createdAt");
        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        return data || [];
      }),

      create: protectedProcedure
        .input(z.object({
          username: z.string().min(3),
          password: z.string().min(6),
          name: z.string().optional(),
          role: z.enum(['user', 'admin']).default('user'),
        }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
          // ... seu código de create
        }),

      update: protectedProcedure
        .input(z.object({
          id: z.number(),
          name: z.string().optional(),
          role: z.enum(['user', 'admin']).optional(),
          password: z.string().min(6).optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          // ... seu código de update
        }),

      delete: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ ctx, input }) => {
          // ... seu código de delete
        }),
    }),

    boards: router({
      addMember: protectedProcedure
        .input(z.object({ boardId: z.number(), userId: z.number(), role: z.enum(['viewer', 'editor', 'admin']).default('viewer') }))
        .mutation(async ({ ctx, input }) => {
          // ... seu código
        }),
      removeMember: protectedProcedure
        .input(z.object({ boardId: z.number(), userId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          // ... seu código
        }),
    }),
  }),

  // ==================== OUTROS ROUTERS PRINCIPAIS ====================
  boards: router({
    list: protectedProcedure.query(async ({ ctx }) => await getUserBoards(ctx.user.id)),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(/* ... */),
    getMembers: protectedProcedure.input(z.object({ boardId: z.number() })).query(/* ... */),
    create: protectedProcedure.input(/* ... */).mutation(/* ... */),
    update: protectedProcedure.input(/* ... */).mutation(/* ... */),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(/* ... */),
    addMember: protectedProcedure.input(/* ... */).mutation(/* ... */),
    getMirrorSettings: protectedProcedure.input(z.object({ boardId: z.number() })).query(/* ... */),
    updateMirrorSettings: protectedProcedure.input(/* ... */).mutation(/* ... */),
  }),

  lists: router({
    getByBoard: protectedProcedure.input(z.object({ boardId: z.number() })).query(/* ... */),
    create: protectedProcedure.input(/* ... */).mutation(/* ... */),
    update: protectedProcedure.input(/* ... */).mutation(/* ... */),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(/* ... */),
  }),

  cards: router({
    getByList: protectedProcedure.input(z.object({ listId: z.number() })).query(/* ... */),
    getArchivedByBoard: protectedProcedure.input(z.object({ boardId: z.number() })).query(/* ... */),
    create: protectedProcedure.input(/* ... */).mutation(/* ... */),
    getDetails: protectedProcedure.input(z.object({ id: z.number() })).query(/* ... */),
    update: protectedProcedure.input(/* ... */).mutation(/* ... */),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(/* ... */),
    reorder: protectedProcedure.input(/* ... */).mutation(/* ... */),
  }),

  settings: router({
    getPreferences: protectedProcedure.query(/* ... */),
    updatePreferences: protectedProcedure.input(/* ... */).mutation(/* ... */),
    updateProfile: protectedProcedure.input(/* ... */).mutation(/* ... */),
  }),

  notes: router({
    list: protectedProcedure.query(/* ... */),
    create: protectedProcedure.input(z.object({ title: z.string() })).mutation(/* ... */),
  }),

  cardDetails: router({
    // Todos os procedimentos de cardDetails (getLabels, addLabel, updateDescription, etc.)
    getLabels: protectedProcedure.input(z.object({ cardId: z.number() })).query(/* ... */),
    addLabel: protectedProcedure.input(/* ... */).mutation(/* ... */),
    // ... continue com todos os outros que você tinha (getChecklists, addChecklistGroup, etc.)
    createMirror: protectedProcedure.input(/* ... */).mutation(/* ... */),
    getMirroredCards: protectedProcedure.input(z.object({ boardId: z.number() })).query(/* ... */),
    getCardMirrors: protectedProcedure.input(z.object({ cardId: z.number() })).query(/* ... */),
    // ... todos os demais
  }),

  stats: router({
    getGeneral: protectedProcedure.query(/* ... */),
  }),

  checklistTemplates: router({
    list: protectedProcedure.query(/* ... */),
    applyTemplate: protectedProcedure.input(/* ... */).mutation(/* ... */),
    create: protectedProcedure.input(/* ... */).mutation(/* ... */),
    incrementUsage: protectedProcedure.input(z.object({ id: z.number() })).mutation(/* ... */),
  }),

  ai: router({
    chat: protectedProcedure
      .input(z.object({
        messages: z.array(z.object({ role: z.enum(["user", "assistant", "system"]), content: z.string() })),
        useWebSearch: z.boolean().optional(),
        shortResponse: z.boolean().optional(),
      }))
      .mutation(/* seu código de IA aqui */),
  }),
});

export type AppRouter = typeof appRouter;
