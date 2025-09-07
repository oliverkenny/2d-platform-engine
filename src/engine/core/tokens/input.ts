import { defineToken } from "../Token";
import { InputReadPort } from "../ports/input.read";

export const INPUT_READ = defineToken<InputReadPort>('INPUT_READ');