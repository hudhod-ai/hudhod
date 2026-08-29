import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

// Zod 4 schemas only gain `.openapi()` if they are constructed after this patch runs,
// so every schema module must import `z` from here rather than from "zod" directly.
extendZodWithOpenApi(z);

export { z };
