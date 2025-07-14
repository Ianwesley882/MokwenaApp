-- Create database
CREATE DATABASE mokwena;

-- Create user with full privileges
CREATE USER 'mokwena'@'localhost' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON mokwena.* TO 'mokwena'@'localhost';
FLUSH PRIVILEGES;

-- Use the database
USE mokwena;

-- Create Users table
CREATE TABLE Users (
    UserID INT AUTO_INCREMENT PRIMARY KEY,
    Surname VARCHAR(50) NOT NULL,
    Password VARCHAR(20) NOT NULL
);

-- Create UserDetails table
CREATE TABLE UserDetails (
    UserDetailsID INT AUTO_INCREMENT PRIMARY KEY,
    UserID INT NOT NULL,
    FirstName VARCHAR(50) NOT NULL,
    LastName VARCHAR(50) NOT NULL,
    DateOfBirth DATE NOT NULL,
    Province VARCHAR(20) NOT NULL,
    Gender VARCHAR(6) NOT NULL,
    Facilitator BOOLEAN NOT NULL,
    FOREIGN KEY (UserID) REFERENCES Users(UserID)
);

-- Insert super-user
INSERT INTO Users (Surname, Password) VALUES ('Mokwena', 'admin123');
INSERT INTO UserDetails (UserID, FirstName, LastName, DateOfBirth, Province, Gender, Facilitator)
VALUES (1, 'Admin', 'Mokwena', '1980-01-01', 'Gauteng', 'Male', TRUE);