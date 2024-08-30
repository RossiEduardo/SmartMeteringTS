import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Measure {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	image: string = '';

	@Column()
	customer_code: string = '';

	@Column()
	measure_datetime: Date = new Date();

	@Column()
	measure_type: string = '';

	@Column()
	uuid: string = '';

	@Column()
	measure_value: number = 0;

	@Column()
	measure_confirmed: boolean = false;
}
