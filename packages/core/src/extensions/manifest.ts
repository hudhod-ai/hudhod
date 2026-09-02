/**
 * Runtime validation for extension manifests.
 *
 * The SDK owns the TypeScript shape. This module owns runtime validation at the
 * trust boundary, because extension manifests may eventually arrive from JSON
 * rather than a typechecked first-party module.
 *
 * @packageDocumentation
 */

import type { ExtensionManifest } from "@hudhod/sdk";
import { z } from "zod";

import { parseKeybinding } from "../keybindings/keybinding-parser";

const extensionId = z
  .string()
  .min(3)
  .max(128)
  .regex(
    /^[a-z0-9][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+$/,
    "must be a dot-separated lowercase identifier, for example acme.todo-finder",
  );

const commandContribution = z.object({
  id: z.string().min(1).max(256),
  title: z.string().min(1).max(256),
  category: z.string().min(1).max(128).optional(),
});

const panelContribution = z.object({
  id: z.string().min(1).max(256),
  title: z.string().min(1).max(256),
  icon: z.unknown().optional(),
  location: z.enum(["left", "right", "bottom", "center"]).optional(),
});

const viewContainerContribution = z.object({
  id: z.string().min(1).max(256),
  title: z.string().min(1).max(256),
  icon: z.unknown().optional(),
  location: z.enum(["left", "right", "bottom", "center"]).optional(),
});

const viewContribution = z.object({
  id: z.string().min(1).max(256),
  title: z.string().min(1).max(256),
  container: z.string().min(1).max(256),
  order: z.number().finite().optional(),
});

const keybindingContribution = z.object({
  command: z.string().min(1),
  key: z
    .string()
    .min(1)
    .superRefine((val, ctx) => {
      try {
        parseKeybinding(val);
      } catch {
        ctx.addIssue({
          code: "custom",
          message: `Invalid keybinding syntax: ${val}`,
        });
      }
    }),
  mac: z
    .string()
    .min(1)
    .superRefine((val, ctx) => {
      try {
        parseKeybinding(val);
      } catch {
        ctx.addIssue({
          code: "custom",
          message: `Invalid macOS keybinding syntax: ${val}`,
        });
      }
    })
    .optional(),
});

const activationEvent = z.union([
  z.literal("onStartup"),
  z.string().regex(/^onCommand:[^\s]+$/),
  z.string().regex(/^onFileOpen:.+$/),
  z.string().regex(/^onView:[^\s]+$/),
]);

/** Validates the serializable shape of an extension manifest. */
export const extensionManifestSchema = z
  .object({
    id: extensionId,
    name: z.string().min(1).max(128),
    version: z
      .string()
      .regex(
        /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/,
        "must be a semantic version",
      ),
    description: z.string().max(512).optional(),
    activationEvents: z.array(activationEvent).min(1).optional(),
    contributes: z
      .object({
        commands: z.array(commandContribution).optional(),
        panels: z.array(panelContribution).optional(),
        viewContainers: z.array(viewContainerContribution).optional(),
        views: z.array(viewContribution).optional(),
        keybindings: z.array(keybindingContribution).optional(),
      })
      .optional(),
  })
  .superRefine((manifest, context) => {
    const commandIds =
      manifest.contributes?.commands?.map((command) => command.id) ?? [];
    const panelIds =
      manifest.contributes?.panels?.map((panel) => panel.id) ?? [];
    const viewContainerIds =
      manifest.contributes?.viewContainers?.map((container) => container.id) ??
      [];
    const views = manifest.contributes?.views ?? [];
    const viewIds = views.map((view) => view.id);
    const keybindings = manifest.contributes?.keybindings ?? [];

    if (new Set(commandIds).size !== commandIds.length) {
      context.addIssue({
        code: "custom",
        path: ["contributes", "commands"],
        message: "command contribution ids must be unique",
      });
    }
    if (new Set(panelIds).size !== panelIds.length) {
      context.addIssue({
        code: "custom",
        path: ["contributes", "panels"],
        message: "panel contribution ids must be unique",
      });
    }
    if (new Set(viewContainerIds).size !== viewContainerIds.length) {
      context.addIssue({
        code: "custom",
        path: ["contributes", "viewContainers"],
        message: "view container contribution ids must be unique",
      });
    }
    if (new Set(viewIds).size !== viewIds.length) {
      context.addIssue({
        code: "custom",
        path: ["contributes", "views"],
        message: "view contribution ids must be unique",
      });
    }
    // Validate keybindings reference existing commands
    for (const [i, kb] of keybindings.entries()) {
      if (!commandIds.includes(kb.command)) {
        context.addIssue({
          code: "custom",
          path: ["contributes", "keybindings", i, "command"],
          message: `Command '${kb.command}' is not defined in contributes.commands`,
        });
      }
    }

    // Check for duplicate (key, command) pairs
    const seen = new Set<string>();
    for (const [i, kb] of keybindings.entries()) {
      const key = kb.key;
      const pair = `${key}:${kb.command}`;
      if (seen.has(pair)) {
        context.addIssue({
          code: "custom",
          path: ["contributes", "keybindings", i],
          message: `Duplicate keybinding: key '${key}' for command '${kb.command}'`,
        });
      }
      seen.add(pair);
    }
  });

/**
 * Validates a manifest or throws `ZodError` with field-level diagnostics.
 *
 * @example
 * ```ts
 * const manifest = parseExtensionManifest(rawJson);
 * ```
 */
export function parseExtensionManifest(value: unknown): ExtensionManifest {
  return extensionManifestSchema.parse(value) as ExtensionManifest;
}
