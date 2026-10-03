// This is the one module in the package with a side effect. Importing it registers
// `<coffee-json>`. Import `./coffee-json.js` instead to register it yourself.
import { defineCoffeeJson } from "./coffee-json.js";

defineCoffeeJson();
