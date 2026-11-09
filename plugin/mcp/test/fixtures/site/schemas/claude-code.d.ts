// The Claude Code 2.1.307 Mod API type file, as the program embeds it.
declare module 'claude-code' {
  /**
   * What a `tool.check` hook returns.
   */
  export type ToolCheckResult = {
      /** `allow` runs the tool. */
      decision: 'allow' | 'ask' | 'deny';
      /**
       * The plugin whose hook made this ask.
       */
      readonly plugin?: string;
  };
  export interface CoreEngineInterface {
      tool: {
          /**
           * Asks the engine's permission decision for a tool call now.
           */
          check(input: { tool: string }): Promise<ToolCheckResult>;
      };
  }
  export type EngineEventOf = {
      /** Fires when the engine decides whether a tool call may run. */
      'tool.check': { tool: string };
  };
}
