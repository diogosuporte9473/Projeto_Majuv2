.invokeLLM
  .input(z.object({
    messages: z.array(z.object({ role: z.string(), content: z.string() })),
    useWebSearch: z.boolean().optional(),
    shortResponse: z.boolean().optional(),
  }))
  .mutation(async ({ input }) => {
    const result = await invokeLLM({
      messages: input.messages,
      useWebSearch: input.useWebSearch,
      shortResponse: input.shortResponse,
    });
    return result;
  });
