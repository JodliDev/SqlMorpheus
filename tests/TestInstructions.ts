import DatabaseInstructions from "../src/lib/typings/DatabaseInstructions";
import {BackendTable, Class} from "../src/lib/typings/BackendTable";
import Entity from "../src/lib/decorators/Entity";

@Entity("TestTable1", "id")
export class TestTable1 {
	id: number = 0;
	s1: string = "s1";
	n1: number = 5;
	b1: boolean = true;
}

@Entity("TestTable1", "id2")
export class TestTable1Variation1 extends TestTable1 {
	id2: number = 0;
}


@Entity("TestTable2", "id")
export class TestTable2 {
	id: number = 0;
	ss1: string = "s1";
	nn1: number = 1;
	bb1: boolean = true;
	table1_id: number = 0;
}

@Entity("TestTable2", "id")
export class TestTable2Variation1 extends TestTable2 {
	newValue: string = "newValue";
}

export class TestInstructions implements DatabaseInstructions {
	dialect = "Sqlite";
	version: number = 1;
	configPath: string = `${process.cwd()}/configs/`;
	tables: Class<BackendTable>[] = [
		TestTable1,
		TestTable2
	];
}