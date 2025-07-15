import {BackendTable} from "../typings/BackendTable.ts";
import TableInfo from "./TableInfo.ts";

export type TableObjects = Record<string, { columns: BackendTable, tableInfo?: TableInfo }>;