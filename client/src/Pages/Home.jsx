import { ExternalLinkIcon, PlusCircleIcon } from "@heroicons/react/outline";
import { ReactComponent as Group } from "../images/group.svg";
import { ReactComponent as MoneyBag } from "../images/MoneyBag.svg";
import { Link, useNavigate } from "react-router-dom";
import BarGraph from "../Components/Graph/BarChart";
import PieGraph from "../Components/Graph/PieChart";
import { useState, useEffect } from "react";
import getGroupDetails from "../GetData/GroupDetails";
import getUserDeatils from "../GetData/UserDetails";
import Button from "../Components/Button";
import axios from 'axios';
import { BeatLoader } from "react-spinners";
import NavBar from "../Components/NavBar";

const Home = () => {
    const navigate = useNavigate();
    const [groupList, setGroup] = useState([]);
    const [currentUser, setCurrentUser] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUserDetails = async () => {
            try {
                await getUserDeatils(setCurrentUser);
            } catch (error) {
                console.error('Error fetching user details:', error);
                navigate("/");
            }
        };
        fetchUserDetails();
    }, [navigate]);

    useEffect(() => {
        if (currentUser._id) {
            const fetchGroupDetails = async () => {
                try {
                    await getGroupDetails(setGroup, currentUser._id);
                } catch (error) {
                    console.error('Error fetching group details:', error);
                } finally {
                    setLoading(false);
                }
            };
            fetchGroupDetails();
        }
    }, [currentUser]);

    const callHomePage = async () => {
        try {
            const response = await axios.get("/user/details", {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json"
                },
                withCredentials: true
            });

            if (response.status !== 200) {
                alert("Error");
            }
        } catch (error) {
            console.error('Error fetching homepage data:', error);
            navigate("/");
        }
    };

    useEffect(() => {
        callHomePage();
    }, []);

    return (
        <div className="dark:bg-gray-900 text-white md:w-[90%] lg:w-[90%] mx-auto">
            <div className="my-10 px-6 lg:px-8 xl:max-w-6xl">
                <div className="my-12">
                    <div className="flex justify-between border-b pb-6">
                        <h1 className="text-2xl font-bold">Your Groups</h1>
                        {groupList.length > 3 && (
                            <Link to="/groups">
                                <Button
                                    type="link"
                                    rightIcon={<ExternalLinkIcon className="w-5" />}
                                >
                                    View All
                                </Button>
                            </Link>
                        )}
                    </div>
                    {loading ? (
                        <div className="flex justify-center mt-10">
                            <BeatLoader />
                        </div>
                    ) : (
                        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {groupList.slice(0, 3).map((group) => (
                                <div
                                    key={group._id}
                                    className="flex flex-col justify-between h-56 border-2 rounded shadow-sm p-4"
                                >
                                    <div>
                                        <h2 className="text-2xl font-bold">{group.name}</h2>
                                        <p className="mt-2 text-sm text-gray-500">{group.description}</p>
                                        <div className="mt-4">
                                            <p className="flex items-center text-sm font-semibold">
                                                <MoneyBag className="h-6 w-6 mr-2" />
                                                Total Expenses:
                                                <span className="ml-1 text-2xl font-semibold">{group.totalExpenses}</span>
                                            </p>
                                            <p className="flex items-center mt-3 text-sm font-semibold">
                                                <Group className="h-6 w-6 mr-2" />
                                                Members:
                                                <span className="ml-1 text-2xl font-semibold">{group.members.length}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex justify-end mt-4">
                                        <Link to={`/group/detail/${group._id}`}>
                                            <Button
                                                type="link"
                                                rightIcon={<ExternalLinkIcon className="w-5" />}
                                            >
                                                Open
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            ))}
                            {groupList.length < 3 && (
                                <Link to="/addgroup" className="flex items-center justify-center h-56 border-2 border-dashed rounded shadow-sm">
                                    <Button type="link">
                                        <PlusCircleIcon className="mb-4 w-10 stroke-1 text-gray-600" />
                                        <p className="text-2xl font-medium text-gray-600">Add Group</p>
                                    </Button>
                                </Link>
                            )}
                        </div>
                    )}
                </div>

                <div className="mt-12">
                    <div className="border-b pb-6">
                        <h1 className="text-2xl font-bold">Expense Overview</h1>
                    </div>
                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                        <div className="md:pl-8">
                            <PieGraph currentUser={currentUser} />
                        </div>
                        <div className="md:pl-8">
                            <BarGraph />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Home;


