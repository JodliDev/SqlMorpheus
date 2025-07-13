import QueryBuilder from "../../tyque/src/lib/queryBuilder/QueryBuilder.ts";

class TestClass {
	public testString: string = "test"
	public testNumber: number = 5
	public testBoolean1: boolean = true
	public testBoolean2: boolean = false
}

export async function greet(name: string) {
	const tyQue = new QueryBuilder(
		"sqlite",
		async (query, values) => {
			console.log(query, values)
			return []
		},
		async (query, values) => {
			console.log(query, values)
			return 0
		},
		async (query, values) => {
			console.log(query, values)
			return 0
		},
		async (query, values) => {
			console.log(query, values)
			return 0
		}
	)
	
	const r = await tyQue.select(TestClass, {a1: "testBoolean1", a2: "testBoolean2", a3: "testString", a4: "testNumber"})
		.where(b => b.where("a1", "=", true).and().cond("testBoolean1", "=", false))
		.orderBY("a3")
		.build()
	console.log(r)
	
	
	return `Hello, ${name}!`;
}