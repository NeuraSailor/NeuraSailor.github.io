```c++
#include "rclcpp/rclcpp.hpp" //包含rclcpp头文件，使用rclcpp命名空间

class PersonNode : public rclcpp::Node // 继承rclcpp::Node类
{
private:
    std::string name_; // 类内变量
    int age_;

public:
    PersonNode(const std::string &node_name, const std::string &name,const int & age) // 申明输入的参数,const限制变量为只读变量，避免意外修改
        : Node(node_name)                                                       // 第一个参数赋值给父类
    {
        this->name_ = name; // 参数赋值给类内变量
        this->age_ = age;
    }

    void eat(const std::string &food_name) // 定义eat方法
    {
        RCLCPP_INFO(this->get_logger(), "我是%s,%d岁，爱吃%s", this->name_.c_str(), this->age_, food_name.c_str());
    }
};

int main(int argc, char * argv[])
{
    rclcpp::init(argc, argv);
    auto node = std::make_shared<PersonNode>("person_node","张三",25);
    RCLCPP_INFO(node->get_logger(), "Hello, ROS2 from C++17!");
    node -> eat("鱼香肉丝");
    rclcpp::spin(node);
    rclcpp::shutdown();
    return 0;
}
```

