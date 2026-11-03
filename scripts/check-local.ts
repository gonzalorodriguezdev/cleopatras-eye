import 'dotenv/config';
import {readFile} from 'node:fs/promises';
import {inspectAuctionator} from '../server/auctionator';
console.log(inspectAuctionator(await readFile(process.env.AUCTIONATOR_FILE!)));
