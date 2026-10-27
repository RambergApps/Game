// Grunt: søker nærmeste dekning beskyttet mot spilleren, kikker ut og skyter i salver, holder linja.
import { chooseCover } from '../ai.js';

export const grunt = {
  think(world, e, opts) { chooseCover(world, e, opts); },
};
