import {BackendTable} from "../typings/BackendTable";
import TableInfo from "./TableInfo";

export type TableObjects = Record<string, { columns: BackendTable, tableInfo?: TableInfo }>;