const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = 8080;

// Configuration de la base de données PostgreSQL
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'chrono',
    password: 'admin',
    port: 5432,
});

// Middleware
app.use(bodyParser.json());
app.use(express.static('/home/chrono/mon-serveur-express'));

// Route pour récupérer tous les coureurs
app.get('/api/coureurs', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM coureurs');
        res.json(result.rows);
    } catch (err) {
        console.error('Erreur récupération :', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Route pour mettre à jour un coureur
app.put('/api/coureurs/:id', async (req, res) => {
    const { id } = req.params;
    const { nomcoureur, prenomcoureur, datenaissance, email, telephone, accordphoto, present } = req.body;

    try {
        await pool.query(
            'UPDATE coureurs SET nomcoureur = $1, prenomcoureur = $2, datenaissance = $3, email = $4, telephone = $5, accordphoto = $6, present = $7 WHERE idcoureur = $8',
            [nomcoureur, prenomcoureur, datenaissance, email, telephone, accordphoto, present, id]
        );
        res.json({ message: 'Mise à jour réussie' });
    } catch (err) {
        console.error('Erreur mise à jour :', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Route pour servir la page HTML
app.get('/', (req, res) => {
    res.sendFile(path.join('/home/chrono/mon-serveur-express', 'test.html'));
});

// GESTION DES DOSSARDS - NOUVELLES ROUTES

// 1. Obtenir tous les dossards (simplifié)
app.get('/api/dossards', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT iddossard, uid, numero, disponible FROM dossards ORDER BY numero'
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Erreur récupération des dossards:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// 2. Obtenir un dossard spécifique par son ID
app.get('/api/dossards/:iddossard', async (req, res) => {
    const { iddossard } = req.params;
    try {
        const result = await pool.query(
            'SELECT iddossard, uid, numero, disponible FROM dossards WHERE iddossard = $1',
            [iddossard]
        );
        
        if (result.rows.length === 0) {
            res.status(404).json({ message: 'Dossard non trouvé.' });
        } else {
            res.json(result.rows[0]);
        }
    } catch (err) {
        console.error('Erreur récupération du dossard:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// 3. Obtenir les dossards disponibles
app.get('/api/dossards/disponibles', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT iddossard, numero FROM dossards WHERE disponible = true ORDER BY numero'
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Erreur récupération des dossards disponibles:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// 4. Obtenir le premier dossard disponible
app.get('/api/dossards/premier-disponible', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT iddossard, numero FROM dossards WHERE disponible = true ORDER BY numero LIMIT 1'
        );
        
        if (result.rows.length === 0) {
            res.status(404).json({ message: 'Aucun dossard disponible.' });
        } else {
            res.json(result.rows[0]);
        }
    } catch (err) {
        console.error('Erreur récupération du premier dossard disponible:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// 5. Attribuer un dossard spécifique
app.post('/api/dossards/attribuer', async (req, res) => {
    const { iddossard, uid } = req.body;
    
    try {
        // Vérifie si le dossard existe et est disponible
        const checkResult = await pool.query(
            'SELECT disponible FROM dossards WHERE iddossard = $1',
            [iddossard]
        );
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ message: 'Dossard non trouvé.' });
        }
        
        if (!checkResult.rows[0].disponible) {
            return res.status(400).json({ message: 'Dossard déjà attribué.' });
        }
        
        // Vérifie si l'UID a déjà un dossard
        const uidCheck = await pool.query(
            'SELECT numero FROM dossards WHERE uid = $1',
            [uid]
        );
        
        if (uidCheck.rows.length > 0) {
            return res.status(400).json({ 
                message: `Cet UID a déjà le dossard numéro ${uidCheck.rows[0].numero}`
            });
        }
        
        // Attribue le dossard
        await pool.query(
            'UPDATE dossards SET disponible = false, uid = $1 WHERE iddossard = $2 RETURNING numero',
            [uid, iddossard]
        );
        
        res.json({ message: 'Dossard attribué avec succès.' });
    } catch (error) {
        console.error('Erreur lors de l\'attribution du dossard:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// 6. Libérer un dossard
app.post('/api/dossards/liberer/:iddossard', async (req, res) => {
    const { iddossard } = req.params;
    
    try {
        // Vérifie si le dossard existe
        const checkResult = await pool.query(
            'SELECT uid, numero FROM dossards WHERE iddossard = $1',
            [iddossard]
        );
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ message: 'Dossard non trouvé.' });
        }
        
        // Libère le dossard
        await pool.query(
            'UPDATE dossards SET disponible = true, uid = NULL WHERE iddossard = $1 RETURNING numero',
            [iddossard]
        );
        
        res.json({ 
            message: `Dossard libéré avec succès`,
            numero: checkResult.rows[0].numero
        });
    } catch (error) {
        console.error('Erreur lors de la libération du dossard:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// 7. Attribuer automatiquement le premier dossard disponible
app.post('/api/dossards/attribuer-auto', async (req, res) => {
    const { uid } = req.body;
    
    try {
        // Vérifie si l'UID a déjà un dossard
        const existingBib = await pool.query(
            'SELECT numero FROM dossards WHERE uid = $1',
            [uid]
        );
        
        if (existingBib.rows.length > 0) {
            return res.status(400).json({ 
                message: `Cet UID a déjà le dossard numéro ${existingBib.rows[0].numero}` 
            });
        }
        
        // Trouve le premier dossard disponible
        const availableBib = await pool.query(
            'SELECT iddossard, numero FROM dossards WHERE disponible = true ORDER BY numero LIMIT 1'
        );
        
        if (availableBib.rows.length === 0) {
            return res.status(404).json({ message: 'Aucun dossard disponible.' });
        }
        
        // Attribue le dossard
        const dossard = availableBib.rows[0];
        await pool.query(
            'UPDATE dossards SET disponible = false, uid = $1 WHERE iddossard = $2',
            [uid, dossard.iddossard]
        );
        
        res.json({ 
            message: `Dossard numéro ${dossard.numero} attribué avec succès`,
            dossard: dossard
        });
    } catch (error) {
        console.error('Erreur lors de l\'attribution automatique du dossard:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// 8. Rechercher un dossard par UID
app.get('/api/dossards/par-uid/:uid', async (req, res) => {
    const { uid } = req.params;
    try {
        const result = await pool.query(
            'SELECT iddossard, numero, disponible FROM dossards WHERE uid = $1',
            [uid]
        );
        
        if (result.rows.length === 0) {
            res.status(404).json({ message: 'Aucun dossard trouvé pour cet UID.' });
        } else {
            res.json(result.rows[0]);
        }
    } catch (err) {
        console.error('Erreur recherche par UID:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// 9. Vérifier et mettre à jour la disponibilité d'un dossard
app.post('/api/dossards/disponibilite/:iddossard', async (req, res) => {
    const { iddossard } = req.params;
    const { disponible } = req.body;
    
    // Vérifie que la valeur de disponibilité est bien fournie
    if (disponible === undefined) {
        return res.status(400).json({ 
            message: 'La valeur de disponibilité (true/false) doit être fournie.' 
        });
    }
    
    try {
        // Vérifie si le dossard existe
        const checkResult = await pool.query(
            'SELECT numero, disponible FROM dossards WHERE iddossard = $1',
            [iddossard]
        );
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ message: 'Dossard non trouvé.' });
        }
        
        const dossardActuel = checkResult.rows[0];
        
        // Si le dossard est déjà dans l'état demandé, pas besoin de mise à jour
        if (dossardActuel.disponible === disponible) {
            return res.json({
                message: `Le dossard numéro ${dossardActuel.numero} est déjà ${disponible ? 'disponible' : 'indisponible'}.`,
                numero: dossardActuel.numero,
                disponible: disponible
            });
        }
        
        // Si on veut rendre le dossard disponible, il faut aussi effacer l'UID associé
        if (disponible === true) {
            await pool.query(
                'UPDATE dossards SET disponible = true, uid = NULL WHERE iddossard = $1',
                [iddossard]
            );
        } else {
            // Si on veut rendre le dossard indisponible sans l'assigner à un utilisateur
            await pool.query(
                'UPDATE dossards SET disponible = false WHERE iddossard = $1',
                [iddossard]
            );
        }
        
        res.json({
            message: `Disponibilité du dossard numéro ${dossardActuel.numero} mise à jour avec succès.`,
            numero: dossardActuel.numero,
            disponible: disponible
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la disponibilité du dossard:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// 10. Obtenir le statut de disponibilité d'un dossard
app.get('/api/dossards/disponibilite/:iddossard', async (req, res) => {
    const { iddossard } = req.params;
    
    try {
        const result = await pool.query(
            'SELECT numero, disponible FROM dossards WHERE iddossard = $1',
            [iddossard]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Dossard non trouvé.' });
        }
        
        const dossard = result.rows[0];
        res.json({
            numero: dossard.numero,
            disponible: dossard.disponible
        });
    } catch (err) {
        console.error('Erreur lors de la vérification de la disponibilité du dossard:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Route pour mettre à jour un dossard
app.put('/api/dossards/:iddossard', async (req, res) => {
    const { iddossard } = req.params;
    const { disponible } = req.body;

    try {
        await pool.query(
            'UPDATE dossards SET disponible = $1 WHERE iddossard = $2',
            [disponible, iddossard]
        );
        res.json({ message: 'Mise à jour réussie' });
    } catch (err) {
        console.error('Erreur mise à jour :', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// NOUVELLE ROUTE: Attribution d'un dossard à un coureur
app.post('/api/assign-dossard', async (req, res) => {
    const { dossardId, coureurId } = req.body;
    
    try {
        // 1. Vérifier si le dossard existe et est disponible
        const dossardCheck = await pool.query(
            'SELECT iddossard, numero, disponible FROM dossards WHERE iddossard = $1',
            [dossardId]
        );
        
        if (dossardCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Dossard non trouvé.' });
        }
        
        if (!dossardCheck.rows[0].disponible) {
            return res.status(400).json({ message: 'Dossard déjà attribué à un autre coureur.' });
        }
        
        // 2. Vérifier si le coureur existe
        const coureurCheck = await pool.query(
            'SELECT idcoureur FROM coureurs WHERE idcoureur = $1',
            [coureurId]
        );
        
        if (coureurCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Coureur non trouvé.' });
        }
        
        // 3. Attribuer le dossard au coureur sans utiliser la colonne uid
        // À la place, créons une association dans une autre table ou utilisons l'ID du coureur directement
        
        // Vérifier si le coureur a déjà un dossard attribué
        const existingDossard = await pool.query(
            'SELECT d.numero FROM dossards d WHERE d.idcoureur = $1',
            [coureurId]
        );
        
        if (existingDossard.rows.length > 0) {
            return res.status(400).json({ 
                message: `Ce coureur a déjà le dossard numéro ${existingDossard.rows[0].numero}` 
            });
        }
        
        // 4. Attribuer le dossard au coureur
        await pool.query(
            'UPDATE dossards SET disponible = false, idcoureur = $1 WHERE iddossard = $2',
            [coureurId, dossardId]
        );
        
        res.json({ 
            message: `Dossard numéro ${dossardCheck.rows[0].numero} attribué avec succès au coureur ID ${coureurId}`,
            dossard: dossardCheck.rows[0].numero,
            coureurId: coureurId
        });
    } catch (error) {
        console.error('Erreur lors de l\'attribution du dossard au coureur:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});




app.get('/api/courses', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                idcourse,
                nomcourse,
                datecourse,
                heurecourse,
                distance,
                description,
                lieu,
                prix,
                maxparticipants
            FROM courses 
            ORDER BY datecourse
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Erreur récupération des courses:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Route pour récupérer les courses d'un coureur spécifique
app.get('/api/coureurs/:id/courses', async (req, res) => {
    const { id } = req.params;
    
    try {
        // Cette requête dépend de votre structure de base de données
        // Voici plusieurs versions selon la structure possible :

        // VERSION 1 : Si vous avez une table de liaison inscriptions
        const result = await pool.query(`
            SELECT 
                c.idcourse,
                c.nomcourse,
                c.datecourse,
                c.heurecourse,
                c.distance,
                c.lieu,
                i.statut,
                i.dateinscription,
                i.numerodossard
            FROM courses c
            INNER JOIN inscriptions i ON c.idcourse = i.idcourse
            WHERE i.idcoureur = $1
            ORDER BY c.datecourse
        `, [id]);

        // VERSION 2 : Si la relation est directe dans la table coureurs
        /* 
        const result = await pool.query(`
            SELECT 
                c.idcourse,
                c.nomcourse,
                c.datecourse,
                c.heurecourse,
                c.distance,
                c.lieu,
                'Inscrit' as statut
            FROM courses c
            WHERE c.idcourse IN (
                SELECT unnest(courses_inscrites) FROM coureurs WHERE idcoureur = $1
            )
            ORDER BY c.datecourse
        `, [id]);
        */

        res.json(result.rows);
    } catch (err) {
        console.error('Erreur récupération des courses du coureur:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Route pour récupérer les participants d'une course
app.get('/api/courses/:id/participants', async (req, res) => {
    const { id } = req.params;
    
    try {
        const result = await pool.query(`
            SELECT 
                cr.idcoureur,
                cr.nomcoureur,
                cr.prenomcoureur,
                cr.email,
                i.statut,
                i.dateinscription,
                d.numero as numerodossard
            FROM coureurs cr
            INNER JOIN inscriptions i ON cr.idcoureur = i.idcoureur
            LEFT JOIN dossards d ON cr.idcoureur = d.idcoureur
            WHERE i.idcourse = $1
            ORDER BY cr.nomcoureur, cr.prenomcoureur
        `, [id]);
        
        res.json(result.rows);
    } catch (err) {
        console.error('Erreur récupération des participants:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Route pour inscrire un coureur à une course
app.post('/api/inscriptions', async (req, res) => {
    const { idcoureur, idcourse, statut = 'inscrit' } = req.body;
    
    try {
        // Vérifier si l'inscription existe déjà
        const existingInscription = await pool.query(`
            SELECT idinscription FROM inscriptions 
            WHERE idcoureur = $1 AND idcourse = $2
        `, [idcoureur, idcourse]);
        
        if (existingInscription.rows.length > 0) {
            return res.status(400).json({ 
                message: 'Ce coureur est déjà inscrit à cette course' 
            });
        }
        
        // Vérifier la capacité de la course
        const courseInfo = await pool.query(`
            SELECT 
                maxparticipants,
                (SELECT COUNT(*) FROM inscriptions WHERE idcourse = $1 AND statut = 'inscrit') as participants_actuels
            FROM courses 
            WHERE idcourse = $1
        `, [idcourse]);
        
        if (courseInfo.rows.length === 0) {
            return res.status(404).json({ message: 'Course non trouvée' });
        }
        
        const { maxparticipants, participants_actuels } = courseInfo.rows[0];
        
        let statutFinal = statut;
        if (maxparticipants && participants_actuels >= maxparticipants) {
            statutFinal = 'liste_attente';
        }
        
        // Créer l'inscription
        const result = await pool.query(`
            INSERT INTO inscriptions (idcoureur, idcourse, statut, dateinscription)
            VALUES ($1, $2, $3, NOW())
            RETURNING idinscription
        `, [idcoureur, idcourse, statutFinal]);
        
        res.json({ 
            message: `Inscription réussie avec le statut: ${statutFinal}`,
            inscriptionId: result.rows[0].idinscription,
            statut: statutFinal
        });
    } catch (err) {
        console.error('Erreur lors de l\'inscription:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Route pour modifier le statut d'une inscription
app.put('/api/inscriptions/:id', async (req, res) => {
    const { id } = req.params;
    const { statut } = req.body;
    
    try {
        const result = await pool.query(`
            UPDATE inscriptions 
            SET statut = $1 
            WHERE idinscription = $2
            RETURNING *
        `, [statut, id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Inscription non trouvée' });
        }
        
        res.json({ 
            message: 'Statut mis à jour avec succès',
            inscription: result.rows[0]
        });
    } catch (err) {
        console.error('Erreur mise à jour inscription:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Route pour désinscrire un coureur d'une course
app.delete('/api/inscriptions/:idcoureur/:idcourse', async (req, res) => {
    const { idcoureur, idcourse } = req.params;
    
    try {
        const result = await pool.query(`
            DELETE FROM inscriptions 
            WHERE idcoureur = $1 AND idcourse = $2
            RETURNING *
        `, [idcoureur, idcourse]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Inscription non trouvée' });
        }
        
        res.json({ message: 'Désinscription réussie' });
    } catch (err) {
        console.error('Erreur lors de la désinscription:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Route pour obtenir les statistiques d'une course
app.get('/api/courses/:id/stats', async (req, res) => {
    const { id } = req.params;
    
    try {
        const result = await pool.query(`
            SELECT 
                c.nomcourse,
                c.maxparticipants,
                COUNT(CASE WHEN i.statut = 'inscrit' THEN 1 END) as inscrits,
                COUNT(CASE WHEN i.statut = 'liste_attente' THEN 1 END) as liste_attente,
                COUNT(CASE WHEN i.statut = 'annule' THEN 1 END) as annules,
                COUNT(i.idinscription) as total_inscriptions
            FROM courses c
            LEFT JOIN inscriptions i ON c.idcourse = i.idcourse
            WHERE c.idcourse = $1
            GROUP BY c.idcourse, c.nomcourse, c.maxparticipants
        `, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Course non trouvée' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Erreur récupération statistiques:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.get('/api/coureurs/:id/courses', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`
            SELECT c.*
            FROM courses c
            INNER JOIN inscriptions i ON i.idcourse = c.idcourse
            WHERE i.idcoureur = $1
            ORDER BY c.datecourse
        `, [id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur récupération courses du coureur' });
    }
});



app.get('/api/coureurs', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT c.*, d.iddossard, d.numero AS dossard
            FROM coureurs c
            LEFT JOIN dossards d ON d.idcoureur = c.idcoureur
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});














// Lancement du serveur
app.listen(port, () => {
    console.log(`Serveur en écoute sur http://127.0.0.1:${port}`);
});
