import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class User {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	customer_code: string = ''; // Inicializar com um valor padrão

	@Column()
	measure_datetime: Date = new Date(); // Inicializar com um valor padrão

	@Column()
	measure_type: string = ''; // Inicializar com um valor padrão
}
