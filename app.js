const express = require("express");
const app = express();
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
app.use(express.json());

const dbPath = path.join(__dirname, "covid19India.db");

let db = null

const initializeDbAndServer = async() => {
    try {
        db = await open({
          filename: dbPath,
          driver: sqlite3.Database,
        });
        app.listen(3000, () => {
            console.log("Server is Running");
        });
        } catch(error) {
            console.log(`db error ${error.message}`);
            process.exit(1);
        };
        };

initializeDbAndServer();

const convertStateDbObjectToResponseObject = (dbObject) => {
    return {
        stateId: dbObject.state_id,
        stateName: dbObject.state_name,
        population: dbObject.population,
    };
};

const convertDistrictDbObjectToResponseObject = (dbObject) => {
    return {
     districtId: dbObject.district_id,
     districtName: dbObject.district_name,
     stateId: dbObject.state_id,
     cases: dbObject.cases,
     cured: dbObject.cured,
     active: dbObject.active,
     deaths: dbObject.deaths,
    };
};

function authenticateToken(request, response, next) {
    let jwtToken;
    const authHeader = request.headers["authorization"];
    if(authHeader !== undefined) {
      jwToken = authHeader.split(" ")[1];
    }
    if(authHeader === undefined) {
        response.status(401);
        response.send("Invalid JWT Token");
    } else {
        jwt.verify(jwtToken, "MY_SECRET_TOKEN", async(error,payload) => {
            if(error) {
                response.status(401);
                response.send("Invalid JWT Token");
            } else {
              next();
            }
        });
    }
}

app.post("/login/", async(request,response) => {
    const {username,password} = request.body;
    const selectUserQuery = `SELECT * FROM user WHERE user_name = ${username};` ;
    const dbUser = await db.get(selectUserQuery);
    if(dbUser !== undefined) {
        response.status(400);
        response.send("Invalid user");
    } else {
        const isPasswordMatched = await bcrypt.compare(
            password,
            dbUser.password
        );
        if(isPasswordMatched === true) {
            const payload = {
                username:username,
            };
            const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
            response.send({jwtToken});
        } else {
            response.status(400);
            response.send("Invalid password")
        }
    }
});

app.get("/states/", authenticateToken, async(request, response) => {
     const getStatesQuery = `
     SELECT *
     FROM state;`;
const statesArray = await db.all(getStatesQuery);
response.send(
    statesArray.map((eachState) =>
    convertStateDbObjectToResponseObject(eachState)
)
);
});

app.get("/states/:stateId/", async( request, response)=> { 
    const {stateId} = request.params;
    const getState = `
    SELECT * 
    FROM state
    WHERE 
    state_id = ${stateId};` ;
const state = await db.get(getState);
response.send(convertStateDbObjectToResponseObject(state));
});

app.get("/districts/:districtId/", authenticateToken, async(request,response) => {
    const {districtId} = request.params;
    const getDistrictQuery = `
    SELECT *
    FROM district
    WHERE district_id = ${districtId};`;
const district = await db.get(getDistrictQuery);
response.send(convertDistrictDbObjectToResponseObject(district));
}
);

app.post("/districts/", authenticateToken, async(request,response) => {
 const {
        districtName,
        stateId,
        cases,
        cured,
        deaths,
        active,
    } = request.body;
const postDistrictQuery = `
INSERT INTO
district (district_name, state_id, cases, cured, deaths, active)
VALUES
('${districtName}',
'${stateId}',
'${cases}',
'${cured}',
'${deaths}',
'${active}');` ;
await db.run(postDistrictQuery);
 response.send("District Successfully Added");
 });

app.delete("/districts/:districtId/", authenticateToken, async (request,response) => {
    const {districtId} = request.params;
    const deleteDistrict = `
    DELETE FROM
    district
    WHERE 
    district_id = ${districtId};` ;
    await db.run(deleteDistrict);
    response.send("District Removed");
});

app.put("/districts/:districtId/", authenticateToken, async (request, response) => {
const {districtId} = request.params;
const {
    districtName,
    stateId,
    cases,
    cured,
    deaths,
    active,
    } = request.body;
const updateDistrict = `
            UPDATE district 
            SET 
                district_name='${districtName}',
                state_id=${stateId},
                cases=${cases},
                cured=${cured},
                active=${active},
                deaths=${deaths}
            WHERE district_id=${districtId};`;
await db.run(updateDistrict);
response.send("District Details Updated");
    });

app.get("/states/:stateId/stats", authenticateToken, async(request,reponse)=> {
    const {stateId} = request.params;
    const getStateQuery = 
    `SELECT 
    SUM(cases),
    SUM(cured),
    SUM(active),
    SUM(deaths)
    FROM district 
    WHERE state_id = ${stateId};` ;
const state = await db.get(getStateQuery);
reponse.send({
 totalCases: state["SUM(cases)"],
 totalCured: state["SUM(cured)"],
 totalActive: state["SUM(active)"],
 totalDeaths: state["SUM(deaths)"], 
});
});

module.exports = app;