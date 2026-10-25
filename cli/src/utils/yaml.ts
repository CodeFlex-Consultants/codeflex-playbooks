import { parse } from "yaml";
import type { ZodError, ZodSchema } from "zod";
import { ConfigValidationError } from "./errors";

export function formatZodIssues(error: ZodError): string {
  return error.issues
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ");
}

export function validateWithSchema<T>(
  parsed: unknown,
  schema: ZodSchema<T>,
  errorPrefix: string,
): T {
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new ConfigValidationError(`${errorPrefix}: ${formatZodIssues(result.error)}`);
  }
  return result.data;
}

export function parseYamlWithSchema<T>(
  content: string,
  schema: ZodSchema<T>,
  errorPrefix: string,
): T {
  return validateWithSchema(parse(content), schema, errorPrefix);
}
