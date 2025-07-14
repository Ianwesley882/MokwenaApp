const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType } = require("docx");
const fs = require("fs");
const app = express();

// DB Setup
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Tfreeman93.',
    database: 'mokwena'
});

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.use(session({
    secret: 'simpleSecret',
    resave: false,
    saveUninitialized: true
}));
app.get('/', (req, res) => {
    res.render('login', { error: '' });
});

app.post('/login', (req, res) => {
    const { surname, password } = req.body;

    if (!surname || !password) {
        return res.render('login', { error: 'All fields required' });
    }

    // Check user
    db.query(
        'SELECT * FROM UserDetails JOIN Users ON Users.UserID = UserDetails.UserID WHERE LastName = ? AND Password = ?',
        [surname, password],
        (err, results) => {
            if (err) throw err;
            if (results.length > 0) {
                req.session.user = results[0];
                res.redirect('/home');
            } else {
                res.render('login', { error: 'Invalid credentials' });
            }
        }
    );
});
app.get('/home', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    res.render('home');
});
// Show the Add User form
app.get('/add-user', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    res.render('addUser', { message: '', error: '' });
});

// Handle form submission
app.post('/add-user', (req, res) => {
    const { firstName, lastName, surname, password, dob, province, gender, facilitator } = req.body;
    
    // Basic form validation
    if ( !firstName || !lastName || !surname || !password || !dob || !province || !gender || facilitator === undefined) {
        return res.render('addUser', {
            error: 'Please fill in all fields.',
            message: ''
        });
    }

    // Step 1: Insert into Users table
    db.query('INSERT INTO Users (Surname, Password) VALUES (?, ?)', [surname, password], (err, result) => {
        if (err) {
            console.error(err);
            return res.render('addUser', { error: 'Failed to add user.', message: '' });
    }

        const newUserID = result.insertId;
        const facilitatorBool = parseInt(facilitator); // Ensures it's a number
        if (isNaN(facilitatorBool) || (facilitatorBool !== 0 && facilitatorBool !== 1)) {
        return res.render('addUser', {
        error: 'Facilitator must be selected (Yes or No).',
        message: ''
    });
 }
        // Step 2: Insert into UserDetails table
        const insertDetails = ` INSERT INTO UserDetails (UserID, FirstName, LastName, DateOfBirth, Province, Gender, Facilitator)
        VALUES (?, ?, ?, ?, ?, ?, ?)`;

        db.query(insertDetails, [
         newUserID,
         firstName,
         lastName,
         dob,
         province,
         gender,
         facilitatorBool  
], (err2) => {
    if (err2) {
        console.error(err2);
        return res.render('addUser', { error: 'Failed to add user details.', message: '' });
    }

                res.render('addUser', {
                message: 'User successfully added!',
                error: ''
            });
        });
    });
});
// Show Manage User Page
app.get('/manage-user', (req, res) => {
    if (!req.session.user) return res.redirect('/');

    const query = `
        SELECT u.UserID, ud.UserDetailsID, ud.FirstName, ud.LastName,
               ud.DateOfBirth, ud.Province, ud.Gender, ud.Facilitator
        FROM Users u
        JOIN UserDetails ud ON u.UserID = ud.UserID
    `;

    db.query(query, (err, results) => {
        if (err) throw err;

        res.render('manageUser', {
            users: results,
            message: req.session.message || ''
        });

        req.session.message = '';
    });
});


// Export to Word
app.post('/export-word', (req, res) => {
    db.query(`
        SELECT FirstName, LastName, DateOfBirth, Province, Gender, Facilitator
        FROM UserDetails
    `, async (err, results) => {
        if (err) {
            console.error("Export error:", err);
            return res.send("Error exporting data.");
        }

        // Create rows
        const tableRows = [
            new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph("First Name")] }),
                    new TableCell({ children: [new Paragraph("Last Name")] }),
                    new TableCell({ children: [new Paragraph("Date of Birth")] }),
                    new TableCell({ children: [new Paragraph("Province")] }),
                    new TableCell({ children: [new Paragraph("Gender")] }),
                    new TableCell({ children: [new Paragraph("Facilitator")] }),
                ],
            }),
            ...results.map(user => new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph(user.FirstName)] }),
                    new TableCell({ children: [new Paragraph(user.LastName)] }),
                    new TableCell({ children: [new Paragraph(user.DateOfBirth.toISOString().slice(0, 10))] }),
                    new TableCell({ children: [new Paragraph(user.Province)] }),
                    new TableCell({ children: [new Paragraph(user.Gender)] }),
                    new TableCell({ children: [new Paragraph(user.Facilitator[0] === 1 ? "Yes" : "No")] }),
                ],
            })),
        ];

        const doc = new Document({
            sections: [{
                properties: {},
                children: [
                    new Paragraph("User Report"),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: tableRows,
                    }),
                ],
            }],
        });

        const buffer = await Packer.toBuffer(doc);

        // Save with unique name
        const fileName = `UserReport_${Date.now()}.docx`;
        const filePath = path.join(__dirname, fileName);

        fs.writeFileSync(filePath, buffer);

        console.log(`MS Word report generated: ${fileName}`);

        // Optionally offer download directly
        res.download(filePath, err => {
            if (err) {
                console.error("Download error:", err);
                res.send("Report saved but could not trigger download.");
            }
            // Optionally: delete the file after sending
            // fs.unlinkSync(filePath);
        });
    });
});
// Show edit user page
app.get('/edit-user/:id', (req, res) => {
    if (!req.session.user) return res.redirect('/');

    const id = req.params.id;

    db.query('SELECT * FROM UserDetails WHERE UserDetailsID = ?', [id], (err, results) => {
        if (err) throw err;
        if (results.length === 0) return res.redirect('/manage-user');

        res.render('editUser', { user: results[0], message: '', error: '' });
    });
});

// Handle user update
app.post('/edit-user/:id', (req, res) => {
    const id = req.params.id;
    const { firstName, lastName } = req.body;

    if (!firstName || !lastName) {
        return res.render('editUser', {
            user: { UserDetailsID: id, FirstName: firstName, LastName: lastName },
            error: 'Both fields required.',
            message: ''
        });
    }

    db.query('UPDATE UserDetails SET FirstName = ?, LastName = ? WHERE UserDetailsID = ?', [firstName, lastName, id], (err) => {
        if (err) throw err;

        res.render('editUser', {
            user: { UserDetailsID: id, FirstName: firstName, LastName: lastName },
            message: 'User updated successfully!',
            error: ''
        });
    });
});
// Show delete confirmation
app.get('/delete-user/:id', (req, res) => {
    if (!req.session.user) return res.redirect('/');

    const id = req.params.id;

    db.query('SELECT * FROM UserDetails WHERE UserDetailsID = ?', [id], (err, results) => {
        if (err) throw err;
        if (results.length === 0) return res.redirect('/manage-user');

        res.render('deleteUser', { user: results[0] });
    });
});

// Handle delete action
app.post('/delete-user/:id', (req, res) => {
    const id = req.params.id;
    const { confirm } = req.body;

    if (confirm === 'no') return res.redirect('/manage-user');

    // Get UserID from UserDetailsID first
    db.query('SELECT UserID FROM UserDetails WHERE UserDetailsID = ?', [id], (err, results) => {
        if (err) throw err;
        if (results.length === 0) return res.redirect('/manage-user');

        const userId = results[0].UserID;

        // First delete from UserDetails, then from Users
        db.query('DELETE FROM UserDetails WHERE UserDetailsID = ?', [id], (err2) => {
            if (err2) throw err2;

            db.query('DELETE FROM Users WHERE UserID = ?', [userId], (err3) => {
                if (err3) throw err3;

                req.session.message = 'User deleted successfully.';
                res.redirect('/manage-user');
            });
        });
    });
});


// Start Server
app.listen(8080, () => {
    console.log('Server running on http://localhost:8080');
});
