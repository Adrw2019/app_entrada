CREATE DATABASE asistencia;

USE asistencia;

CREATE TABLE empleados (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100),
    cedula VARCHAR(20),
    cargo VARCHAR(50),
    celular VARCHAR(20),
    estado BOOLEAN DEFAULT true
);

CREATE TABLE asistencias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empleado_id INT,
    cedula VARCHAR(20),
    fecha DATE,
    hora_entrada TIME,
    hora_salida TIME,
    FOREIGN KEY (empleado_id) REFERENCES empleados(id)
);

CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE,
    email VARCHAR(100) UNIQUE,
    password VARCHAR(255),
    reset_token VARCHAR(255),
    reset_expires BIGINT
);
