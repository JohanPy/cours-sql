## TP1
La base de données **`Comptoir2000`** est une base de données de gestion commerciale contenant des informations relatives à une entreprise.

La table **`Client`** contient les données des clients professionnels de l'entreprise, tandis que la table **`Produit`** recense les produits commercialisés. La table **`Commande`** contient les informations des commandes passées par les clients.

La table **`DetailCommande`** établit le lien entre les commandes et les produits, en précisant la quantité commandée et le prix unitaire.

Enfin, les tables **`Employe`** et **`Categorie`** complètent ce modèle en fournissant respectivement les informations des employés de l'entreprise et les catégories de produits disponibles.

#### Structure de la base
Client (CodeCli, Societe, Contact, Fonction, Adresse, Ville, Region, CodePostal, Pays, Tel, Fax)
Employe (NoEmp, Nom, Prenom, Fonction, TitreCourtoisie, DateNaissance, DateEmbauche, Adresse, Ville, Region, CodePostal, Pays, TelDom, Extension, RendCompteA)
Commande (NoCom, #CodeCli, #NoEmp, DateCom, ALivAvant, DateEnv, #NoMess, Port, Destinataire, AdrLiv, VilleLiv, RegionLiv, CodePostalLiv, PaysLiv)
Messager (NoMess, NomMess, Tel)
Produit (Refprod, Nomprod, #NoFour, #CodeCateg, QteParUnit, PrixUnit, UnitesStock, UnitesCom, NiveauReap, Indisponible)
Fournisseur (NoFour, Societe, Contact, Fonction, Adresse, Ville, Region, CodePostal, Pays, Tel, Fax, PageAccueil)
DetailCommande (NoCom, Refprod, PrixUnit, Qte, Remise)
Categorie (CodeCateg, NomCateg, Description)

Vous trouverez plusieurs pages d'exercices à faire durant ce TP. Ne faites le bonus que si vous avez le temps.

### Fonctions basiques
    1) Trier tous les produits par leur prix unitaire (attribut PrixUnit) 
    2) Lister les trois produits les plus chers
    3) Lister les clients suisses, allemands et belges
    4) Lister les noms des Sociétés dont le nom contient "restaurant" (table Client)
    5) Lister les différents pays des clients (sans doublons)
    6) Idem en ajoutant les villes, le tout trié par ordre alphabétique du pays et de la ville (vous pouvez mettre plusieurs champs dans un Order by)
    7) Lister tous les produits vendus en bouteilles ou en canettes (regardez le champ QteParUnit )
    8) Lister les produits (nom en majuscule et référence) du fournisseur n° 8 dont le prix unitaire est entre 10 et 100€
    9) Lister les numéros d'employés ayant réalisé une commande (cf table Commande) à livrer à Lille, Lyon ou Nantes 
    10)  Lister les produits dont le nom contient le terme "tofu" ou le terme "choco", dont le prix est inférieur à 100€ (vérifiez vos résultats!)
    
### Calculs
    1. Affichez pour chaque produit, le nombre d’unité en ajoutant les unités en stock et celles commandées.
    2. A partir de la table DetailCommande, calculez pour chaque produit de la commande numéro 10251 : le montant de la remise (exprimé en % dans la table) et le montant à payer
    3. [Ajoute une requete]
    
### Chaînes de caractères
Dans une même requête, sur la table Client : 
    1. Concaténer les champs Adresse, Ville, CodePostal et Pays dans un nouveau champ nommé Adresse complète, pour avoir :
       Adresse, CodePostal Ville, Pays
    2. Extraire les deux derniers caractères des codes clients 
    3. Mettre en minuscule le nom des sociétés
    4. Affichez le nom des clients et leur fonction en remplaçant le terme "marketing" par "mercatique"

### Bonus
[ajoute 10 requêtes de complexes à très complexes qui mettent en œuvre dans ce TP et dans les précédents. Mets de l'aide dans des spoilers pour les plus complexes. Propose la correction dans un 2eme spoiler] 

## TP2
Comme lors du précédent TP : vous allez rédiger sur la base de donnée « Comptoir2000 ».
Si vous n’aviez pas fini le TP 1, prenez le temps de les faire (chez vous ou à la fin du TP).
Si des notions ne sont pas claires, n’hésitez pas à me poser des questions ou à consulter le cours sur les thèmes qui vous intéresse et à vous entraîner sur les exemples et les exercices données sur le site.
Vous trouverez plusieurs pages d'exercices à faire durant ce TP. Ne faites le bonus que si vous avez le temps.

### Fonctions de groupe et agrégats

    1. Calculer le nombre de produits de moins de 50€
    2. Calculer le nombre de produits de catégorie 2 et avec plus de 10 unités en stocks  
    3. Calculer le nombre de pays différents de livraison 
    4. Calculer le coût du port minimum et maximum des commandes
    5. Donner le montant moyen du port par messager 
    6. Donner le nombre de catégories de produits fournis par chaque fournisseur
    7. Lister les fournisseurs ne fournissant au moins 2 produits 
    8. Lister les catégories dont les prix sont en moyenne supérieurs strictement à 150€
    
### Choix multiple
A partir de la table Produit, afficher "Produit non disponible" lorsque l'attribut Indisponible vaut 1, et "Produit disponible" sinon. 
    1. Dans la table DetailCommande, indiquer les infos suivantes en fonction de la remise
        ◦ si elle vaut 0 : "aucune remise" 
        ◦ si elle vaut entre 1 et 5% (inclus) : "petite remise" 
        ◦ si elle vaut entre 6 et 15% (inclus) : "remise modérée" 
        ◦ sinon :"remise importante" 
    2. Indiquer pour les commandes envoyées si elles ont été envoyées en retard (date d'envoi DateEnv supérieure (ou égale) à la date butoir ALivAvant) ou à temps
    
### Dates

Afficher la date du jour
    1. Afficher pour chaque commande le jour de la semaine, le numéro de semaine dans l'année et le mois (avec STRFTIME)
    1. Lister les commandes ayant eu lieu un dimanche 
    2. Calculer le nombre de jours entre la date de la commande (DateCom) et la date butoir de livraison (ALivAvant), pour chaque commande (Julianday peut vous aider)
    3. On souhaite aussi contacter les clients 1 an, 1 mois et 1 semaine après leur commande. Calculer la date correspondante pour chaque commande

### Bonus
[ajoute 10 requêtes de complexes à très complexes qui mettent en œuvre dans ce TP et dans les précédents. Mets de l'aide dans des spoilers pour les plus complexes. Propose la correction dans un 2eme spoiler]  

## TP3 
Comme lors du précédent TP : vous allez rédiger sur la base de donnée « Comptoir2000 ».
Si vous n’aviez pas fini le TP 2, prenez le temps de les faire (chez vous ou à la fin du TP).
Si des notions ne sont pas claires (group by, jointures…), n’hésitez pas à me poser des questions ou à consulter le cours sur les thèmes qui vous intéresse et à vous entraîner sur les exemples et les exercices données sur le site.
Vous trouverez plusieurs pages d'exercices à faire durant ce TP. Ne faites le bonus que si vous avez le temps.

### Jointures
    1. Afficher les informations des commandes du client "Lazy K Kountry Store" (Utilisez 2 types de jointures différentes)
    2. Afficher le nombre de commande pour chaque messager en indiquant son nom (Utilisez 2 types de jointures différentes)
    3. Afficher pour chaque employé le nom et le prénom de son responsable
    4. Les noms et le numéro de commande de tous les clients qui ont commandé un produit.
    5. Les noms et le numéro de commande de tous les clients, même ceux qui n'ont pas commandé de produit.
    6. Le nom des clients qui n’ont jamais commandé de produit
    7. Les noms et les prix de tous les produits qui ont été commandés.
    8. Compter pour chaque produit, le nombre de commandes où il apparaît, même pour ceux dans aucune commande
    9. Compter le nombre de produits par pays d'origine des fournisseurs
    10. Compter le nombre de produits commandés pour chaque client pour chaque catégorie
    
### Sous-requêtes
    11. Lister les employés n'ayant jamais effectué une commande
    12. Nombre de produits proposés par la société fournisseur "Mayumis",
    13. Nombre de commandes passées par des employés sous la responsabilité de "Patrick Emery" 
    14. Afficher les noms des produits commandés par le client "Lazy K Kountry Store"
    15. Qui sont les clients qui ont commandé des produits dont le fournisseur est dans leur pays
    16. Il y a-t-il des clients qui sont aussi des fournisseurs ?
    
### Bonus
[ajoute 10 requêtes de complexes à très complexes qui mettent en œuvre dans ce TP et dans les précédents. Mets de l'aide dans des spoilers pour les plus complexes. Propose la correction dans un 2eme spoiler]     

## TP4

Vous allez utiliser les notions vues lors des TP précédents pour travailler sur la base « Gymnase200 ». [configure le pour qu'il sélectionne la base Gymnase200 pour ce TP]  
En regardant la liste des tables, vous trouverez les 7 suivantes :
    • Sports : sports pratiqués 
    • Sportifs : sportifs inscrits 
    • Gymnases : gymnases utilisés 
    • Seances : séances prévues 
    • Jouer : qui joue à quoi ? 
    • Arbitrer : qui arbitre quoi ? 
    • Entrainer : qui entraîne quoi ? 


### Partie I
    1. Lister les sportifs par ordre croissant d'âge 
    2. Lister les 5 gymnases les plus grands
    3. Lister les sportifs (nom et prénom) âgés strictement de plus de 30 ans
    4. Lister les différents sports pratiqués
    5. Lister les sportifs n'ayant pas de conseiller
    6. Afficher la surface des gymnases en cm² (au lieu de m²)
    7. Afficher la liste des sportifs avec un champ nommé Civilite, qui prendra "M." pour les hommes et "Mme" pour les femmes 
    8. Afficher la 1ere lettre du prénom des sportifs qui font du hand-ball suivit d’un point et de leur nom en majuscule
    9. Afficher les gymnases situés sur une place (voir champs Adresse)
    10. Donner la date du jour
    11. Compter le nombre de sportifs ayant un conseiller 
    12. Compter le nombre de villes différentes
    13. Calculer l'âge moyen, l'âge minimum et l'âge maximum des sportifs
    14. Calculer pour chaque ville la surface du plus petit et du plus grand gymnase
    15. Lister les villes ayant plus de 2 gymnases, dans l'ordre décroissant du nombre de gymnases

### Partie II
    1. Quels sont les gymnases de ”Villetaneuse” ou de ”Sarcelles” qui ont une surface de plus de 400 m2 ?  
    2. Dans quels gymnases et quels jours y a-t'il des séances de hand ball ? 
    3. Dans quels gymnases peut-on jouer au hockey le mercredi après 15H ? 
    4. Quels gymnases proposent des séances de basket ball ou de volley ball ? 
    5. Quels sont les entraîneurs qui sont aussi joueurs ? 
    6. Quels sont les joueurs qui sont des conseillers ? 
    7. Pour le sportif "Kervadec" quel est le nom de son conseiller ? 
    8. Qui entraînent du hand ball et du basket ball ? 

### Partie III
    1. Quels sportifs (nom et prénom) ne pratiquent aucun sport ? 
    2. Pour chaque sportif donner le nombre de sports qu'il arbitre 
    3. Quels sont les gymnases ayant plus de 15 séances le mercredi ? 
    4. Dans quels gymnases et quels jours y a-t’il au moins 4 séances de volley ball dans la journée 
    5. Pour chaque entraîneur de hand ball quel est le nombre de séances journalières qu’il assure ? 
    6. Pour chaque gymnase de Montmorency : quel est le nombre de séances journalières de chaque sport proposé ? 
    7. Quel est le sport pour lequel les joueurs sont les plus jeunes ? 
    8. Quels gymnases n'ont pas de séances le dimanche ? 
    9. Quels entraîneurs n’entraînent que du hand ball et/ou du basket ball, mais aucun autre sport ?
    10. Donner le plus grand gymnase pour chacune des villes
    11. Calculer le nombre de sportifs par sexe, ainsi que l'âge moyen
    12. Lister les villes dans lesquelles il y a des gymnases d'au moins 500 m²
    13. Lister les sports ayant le plus de joueurs
    14.  Afficher une nouvelle variable TypeGymnase, qui prendra comme valeur "petit" si la surface est inférieure strictement à 400 m2, "moyen" si elle est entre 400 et 550 m2, et "grand" si elle est strictement supérieure à 550 m2
    
### Partie Bonus
[ajoute 10 requêtes de complexes à très complexes qui mettent en œuvre dans ce TP et dans les précédents. Mets de l'aide dans des spoilers pour les plus complexes. Propose la correction dans un 2eme spoiler] 
