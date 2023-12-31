const { Router } = require('express');
const { ObjectId } = require('mongodb');

const { validateAgainstSchema, extractValidFields } = require('../lib/validation')
const { getDbReference } = require('../lib/mongo');
const { CourseSchema, updateCourseById, getCourseInstructorId, getCourseById } = require('../models/course');
const { getUserByEmail, getUserById} = require('../models/user');

const {requireAuthenticationVer1, requireAuthenticationVer2 } = require("../lib/auth")

const router = Router();

router.get('/', async (req, res, next) => {
    const db = getDbReference();
    const collection = db.collection('courses');
    const page = parseInt(req.query.page) || 1
    const pageSize = 10
    try {
        const totalCount = await collection.countDocuments()
        const totalPages = Math.ceil(totalCount / pageSize)

        const courses = await collection
            .find()
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            .toArray()

        res.status(200).json({
            courses,
            totalPages,
            currentPage: page,
            pageSize,
            totalCount,
        })
    } catch (err) {
        next(err)
    }
});

router.post('/', requireAuthenticationVer1, async (req, res, next) => {

    try {
        if (!validateAgainstSchema(req.body, CourseSchema)) {
            return res.status(400).send({
                error: "Request body is not a valid course object."
            })
        }

        const instructorId = req.body.instructorId
        if (!(req.authUserRole === 'admin' || (req.authUserRole === 'instructor' && req.authUserId === instructorId))) {
            return res.status(403).send({
                error: "The request could not be made by an authenticated User."
            })
        }

        const course = req.body
        const db = getDbReference()
        const collection = db.collection('courses')
        const result = await collection.insertOne(course)
        const returnedId = result.insertedId
        res.status(201).send({
            id: returnedId
        })
    } catch (err) {
        res.status(500).send({message: err.message});
    }
});

router.get('/:id', async (req, res, next) => {
    const id = req.params.id
    try {
        const db = getDbReference()
        const collection = db.collection('courses')
        const course = await collection.findOne({
            _id: new ObjectId(id)
        })
        if (course) {
            res.status(200).send(course)
        } else {
            res.status(404).json({
                error: "Course not found"
            })
        }
    } catch (err) {
        next(err)
    }
});

router.patch('/:id', requireAuthenticationVer1, async (req, res, next) => {
    const id = req.params.id
    const updatedFields = req.body
    const instructorid = await getCourseInstructorId(req.params.id)

    if (instructorid === undefined || instructorid === null) {
        res.status(404).send({ error: 'Instructor ID not found in courses' })
        return
    }
    
    if (validateAgainstSchema(updatedFields, CourseSchema)) {
        const courseBody = extractValidFields(updatedFields, CourseSchema)
        if (req.authUserRole === 'admin' || (req.authUserRole === 'instructor' && req.authUserId === instructorid)) {
            try {
                const db = getDbReference()
                const collection = db.collection('courses')
                await collection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: courseBody }
                )
                res.status(200).send({ message: 'Course updated successfully' })
            } catch (err) {
                next(err)
            }
        } else {
            res.status(403).send({
                error: "The request could not be made by an authenticated User."
            })
        }} else {
        res.status(400).send({
            error: "The requested body is not present or did not contain a valid User object"
        })
    }
});

router.delete('/:id', requireAuthenticationVer1, async (req, res, next) => {
    const id = req.params.id
    const instructorid = await getCourseInstructorId(req.params.id)

    if (instructorid === undefined || instructorid === null) {
        res.status(404).send({ error: 'Instructor ID not found in courses' })
        return
    }
    
    if (req.authUserRole === 'admin' || (req.authUserRole === 'instructor' && req.authUserId === instructorid)) {
        try {
            const db = getDbReference()
            const collection = db.collection('courses')
            const deletedCourse = await collection.deleteOne(
                { _id: new ObjectId(id) }
            )
            if (deletedCourse.deletedCount > 0) {
                res.status(200).send({ message: 'Course deleted successfully' })
            } else {
                next()
            }
        } catch (err) {
            next(err)
        }} else {
            res.status(403).send({
                error: "The request could not be made by an authenticated User."
            })
        }
});

router.get('/:id/students', requireAuthenticationVer1, async (req, res, next) => {
    //console.log(req.authUserId);
    //console.log(req.authUserRole);
    const auth = await getUserByEmail(req.user);
    const instructorid = await getCourseInstructorId(req.params.id);
    //console.log("getCourseInstructorId",getCourseInstructorId)
    if (req.authUserRole === 'admin' || (req.authUserRole === 'instructor' && req.authUserId === instructorid)) {
      const course = await getCourseById(req.params.id);
      //console.log("getCourseById", getCourseById)
  
      if (course) {
        const studentList = [];
        console.log("studentList",studentList)
        if (course.studentsId && course.studentsId.length > 0) {
          for (let i = 0; i < course.studentsId.length; i++) {
            const temp = await getUserById(course.studentsId[i]);
            studentList.push(temp);
          }
        }
  
        res.status(200).send({
          students: studentList
        });
      } else {
        res.status(404).send({
          error: "Course id not found."
        });
      }
    } else {
      res.status(403).send({
        error: "The request could not be made by an authenticated User."
      });
    }
  });

router.post('/:id/students', requireAuthenticationVer1, async(req,res,next)=>{
    console.log("req.body",req.body)
    //const auth = await getUserByEmail(req.user)
    const instructorid = await getCourseInstructorId(req.params.id)
    //console.log("instructorid",instructorid)
    //console.log("req.params.id",req.params.id)
    const course = await getCourseById(req.params.id)
    //console.log("course", course)
    const add = req.body.add
    //console.log("add",add)
    const remove = req.body.remove
    //console.log("remove",remove)
    let studentList = []

    for(let i = 0; i<add.length; i++){
        studentList.push(add[i])
    }
    studentList = studentList.filter(id => !remove.includes(id))
    //console.log("studentList",studentList)

    if(req.authUserRole == 'admin' || (req.authUserRole == 'instructor' && req.authUserId == instructorid)){
        if(course){
            const resBody = {
                _id: course._id,
                subject:course.subject,
                number: course.number,
                title: course.title,
                term: course.term,
                instructorId: course.instructorId,
                studentsId: studentList
            }    
            if(validateAgainstSchema(resBody, CourseSchema)){
                const result = updateCourseById(course._id, resBody)
                res.status(200).send({
                    resBody
                })
            }
            else{
                res.status(400).send({
                    error: "check the require field again."
                })
            }
        }
        else{
            res.status(404).send({
                error:"	Specified Course id not found."
            })
        }
    }
    else{
        res.status(403).send({
            error: "The request could not be made by an authenticated User."
        })
    }

})

router.get('/:id/roster', requireAuthenticationVer1, async (req, res, next) => {
    const id = req.params.id
    const instructorid = await getCourseInstructorId(req.params.id)
    if(req.authUserRole == 'admin' || (req.authUserRole == 'instructor' && req.authUserId == instructorid)){
        try {
            const db = getDbReference()
            const collection = db.collection('courses')
            const course = await collection.findOne({
                _id: new ObjectId(id)
            })
            if (course) {
                const studentList = course.studentsId
                let csvData = ["id", "name", "email"].join(",") + "\r\n"
                for (const studentId of studentList) {
                    const student = await getUserById(studentId);
                    if (student){
                        csvData += [student._id, student.name, student.email].join(",") + "\r\n";
                    } else {
                        res.status(404).send({
                            error: `Student ID ${studentId} not found.`
                        })
                        return
                    }
                }
                res.status(200).set({
                    "Content-Type": "text/csv",
                    "Content-Disposition": `attachment; filename="studentList.csv"`
                }).send(csvData)
            } else {
                next()
            }
        } catch(err) {
            next(err)
    }} else {
        res.status(403).send({
            error: "The request could not be made by an authenticated User."
        })
    }
});

router.get('/:id/assignments', async (req, res, next) => {
    const id = req.params.id
    const db = getDbReference();
    const collection = db.collection('assignments')
    try {
        const assignments = await collection.find({
            courseId: id
        }).toArray()
        const course = await collection.findOne({
            courseId: id
        })
        if (course) {
            if (assignments.length > 0) {
                res.status(200).send(assignments)
            } else {
                res.status(404).send({
                    error: `No assignments for class ID ${id}.`})
            }
        } else {
            res.status(404).send({
                error: `Course ID ${id} not found in assignments.`})
        }
    } catch (err) {
        next(err)
    }
});

module.exports = router;
