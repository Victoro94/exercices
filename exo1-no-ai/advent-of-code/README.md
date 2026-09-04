# partie 1
Transformer l'entrée en matrice pour récupérer les termes et les opérations sans les espaces pour avoir cette forme :
         [[ "1" , "2" , "3" ],
          [ "3" , "2" , "1" ],
          [ "+" , "*" , "+" ]]  

dans ce cas :
m[i][0] contient les termes de la premiere colonne et m[4][0] contient l'opérateur à utiliser.

# partie 2

Dans cette partie, on transforme l'entree avec split() pour récupérer les lignes et on itère sur les lignes obtenus en même temps.

[ "1 2 3",
  "3 2 1",
  "+ * +" ]

On utilise un double pointeur pour savoir de combien on à avancée et pour savoir combien y a t'il de terme dans cette colonne.
Comme on a 5 que lignes on peut juste combiner les charactere des 4 premiere lignes pour obtenir un terme et l'operateur est sous le premier terme de la colonne.