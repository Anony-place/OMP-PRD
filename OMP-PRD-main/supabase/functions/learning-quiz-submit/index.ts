import { mutationHandler } from "../_shared/academy-mutation.ts";
Deno.serve(mutationHandler("quiz"));
